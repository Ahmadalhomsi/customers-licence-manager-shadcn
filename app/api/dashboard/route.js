import { verifyJWT } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { GROUPED_CATEGORIES, getProductLine } from '@/lib/licence-products';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Europe/Istanbul is fixed at UTC+3 (no DST since 2016), so month boundaries are a constant offset.
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const TREND_MONTHS_BEFORE = 6;
const TREND_MONTHS_AFTER = 5;

// "2026-10" for the Istanbul calendar month the date falls in
function monthKey(date) {
    const d = new Date(new Date(date).getTime() + ISTANBUL_OFFSET_MS);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// UTC instant at which the Istanbul month starts (monthIndex is 0-based and may overflow)
function monthStart(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex, 1) - ISTANBUL_OFFSET_MS);
}

// Trials are auto-created as 'custom' services with a "Trial service" description. Converting one
// to a paid licence changes its paymentType but keeps the description, so it stops counting as a trial.
function isTrial(service) {
    return service.customer?.name === 'Trial Customer' ||
        (service.paymentType === 'custom' && Boolean(service.description?.startsWith('Trial service')));
}

// Customers are matched by phone number; those without a usable phone fall back to their id
function customerKey(service) {
    return normalizePhone(service.customer?.phone) || `id:${service.customerID}`;
}

// A device is one Service row. Grouped product lines share one licence per customer;
// every other device is a licence of its own.
function describeDevice(service, deviceId) {
    const line = getProductLine(service.category);
    const customer = customerKey(service);
    return {
        line,
        customer,
        device: deviceId,
        licence: line.grouped ? `${line.key}|${customer}` : `device|${deviceId}`,
    };
}

// Licence key -> { line, customer, devices }
function addDevice(licences, item) {
    const entry = licences.get(item.licence) || { line: item.line, customer: item.customer, devices: new Set() };
    entry.devices.add(item.device);
    licences.set(item.licence, entry);
}

function countDevices(entries) {
    return entries.reduce((total, entry) => total + entry.devices.size, 0);
}

function countDistinctCustomers(entries) {
    return new Set(entries.map((entry) => entry.customer)).size;
}

/**
 * Monthly licence figures for the dashboard (?month=YYYY-MM, default: current Istanbul month).
 * Every figure is counted in licences (see lib/licence-products.js) with the matching device count next to it.
 * - pending:     licences with a device ending in the month that has not been renewed yet
 * - renewed:     licences due in the month whose devices have all been renewed
 * - renewals:    licences renewed in the month (RenewHistory.createdAt); a bulk renewal of 3 devices is 1
 * - newLicences: licences whose first device was created in the month; extra devices are only newDevices
 * Trial services are left out of every figure (counted separately as newTrials);
 * unlimited and archived services are never pending.
 */
export async function GET(req) {
    try {
        const token = req.cookies.get('token')?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canViewServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet görüntüleme izniniz yok' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const requestedMonth = searchParams.get('month') || '';
        const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : monthKey(new Date());
        const [year, month] = selectedMonth.split('-').map(Number);

        const months = [];
        for (let offset = -TREND_MONTHS_BEFORE; offset <= TREND_MONTHS_AFTER; offset++) {
            months.push(monthKey(monthStart(year, month - 1 + offset)));
        }
        const range = {
            gte: monthStart(year, month - 1 - TREND_MONTHS_BEFORE),
            lt: monthStart(year, month + TREND_MONTHS_AFTER),
        };

        const customerSelect = { select: { name: true, phone: true } };
        const [services, renewals, groupedHistory] = await Promise.all([
            prisma.service.findMany({
                where: { OR: [{ endingDate: range }, { createdAt: range }] },
                select: {
                    id: true,
                    category: true,
                    description: true,
                    paymentType: true,
                    archived: true,
                    endingDate: true,
                    createdAt: true,
                    customerID: true,
                    customer: customerSelect,
                },
            }),
            prisma.renewHistory.findMany({
                where: { OR: [{ previousEndDate: range }, { createdAt: range }] },
                select: {
                    serviceId: true,
                    previousEndDate: true,
                    createdAt: true,
                    service: {
                        select: { category: true, description: true, paymentType: true, customerID: true, customer: customerSelect },
                    },
                },
            }),
            // All earlier devices of grouped lines, to tell a new licence from a device added to an existing one
            prisma.service.findMany({
                where: { category: { in: GROUPED_CATEGORIES }, createdAt: { lt: range.lt } },
                select: { id: true, category: true, description: true, paymentType: true, createdAt: true, customerID: true, customer: customerSelect },
            }),
        ]);

        const firstDeviceMonth = new Map();
        for (const service of groupedHistory) {
            if (isTrial(service)) continue;
            const { licence } = describeDevice(service, service.id);
            const created = monthKey(service.createdAt);
            if (!firstDeviceMonth.has(licence) || created < firstDeviceMonth.get(licence)) {
                firstDeviceMonth.set(licence, created);
            }
        }

        const stats = new Map(months.map((key) => [key, {
            pending: new Map(),
            renewed: new Map(),
            renewals: new Map(),
            newLicences: new Map(),
            newDevices: [],
            newTrials: 0,
        }]));

        for (const service of services) {
            if (isTrial(service)) {
                const created = stats.get(monthKey(service.createdAt));
                if (created) created.newTrials++;
                continue;
            }

            const item = describeDevice(service, service.id);

            const due = stats.get(monthKey(service.endingDate));
            if (due && !service.archived && service.paymentType !== 'unlimited') {
                addDevice(due.pending, item);
            }

            const createdMonth = monthKey(service.createdAt);
            const created = stats.get(createdMonth);
            if (created) {
                created.newDevices.push(item);
                if (!item.line.grouped || firstDeviceMonth.get(item.licence) === createdMonth) {
                    addDevice(created.newLicences, item);
                }
            }
        }

        for (const renewal of renewals) {
            if (isTrial(renewal.service)) continue;
            const item = describeDevice(renewal.service, renewal.serviceId);

            // A device still ending in the same month (e.g. a short custom extension) stays pending
            const due = stats.get(monthKey(renewal.previousEndDate));
            if (due && !due.pending.get(item.licence)?.devices.has(item.device)) {
                addDevice(due.renewed, item);
            }

            const done = stats.get(monthKey(renewal.createdAt));
            if (done) addDevice(done.renewals, item);
        }

        // A licence with any device still pending counts as pending, not renewed
        const renewedLicences = (s) => [...s.renewed].filter(([key]) => !s.pending.has(key)).map(([, entry]) => entry);

        const trend = months.map((key) => {
            const s = stats.get(key);
            const pending = [...s.pending.values()];
            const renewed = renewedLicences(s);
            return {
                month: key,
                pending: pending.length,
                renewed: renewed.length,
                expected: pending.length + renewed.length,
                pendingDevices: countDevices(pending),
                renewedDevices: countDevices([...s.renewed.values()]),
                pendingCustomers: countDistinctCustomers(pending),
                expectedCustomers: countDistinctCustomers([...pending, ...renewed]),
                renewals: s.renewals.size,
                renewalDevices: countDevices([...s.renewals.values()]),
                newLicences: s.newLicences.size,
                newDevices: s.newDevices.length,
                newTrials: s.newTrials,
            };
        });

        const selected = stats.get(selectedMonth);
        const byProduct = new Map();
        const productRow = (line) => {
            if (!byProduct.has(line.key)) {
                byProduct.set(line.key, {
                    key: line.key,
                    product: line.label,
                    grouped: line.grouped,
                    pending: 0,
                    renewed: 0,
                    renewals: 0,
                    newLicences: 0,
                    pendingDevices: 0,
                    renewalDevices: 0,
                    newDevices: 0,
                });
            }
            return byProduct.get(line.key);
        };
        for (const entry of selected.pending.values()) {
            const row = productRow(entry.line);
            row.pending++;
            row.pendingDevices += entry.devices.size;
        }
        for (const entry of renewedLicences(selected)) productRow(entry.line).renewed++;
        for (const entry of selected.renewals.values()) {
            const row = productRow(entry.line);
            row.renewals++;
            row.renewalDevices += entry.devices.size;
        }
        for (const entry of selected.newLicences.values()) productRow(entry.line).newLicences++;
        for (const item of selected.newDevices) productRow(item.line).newDevices++;

        const products = [...byProduct.values()]
            .map((row) => ({ ...row, expected: row.pending + row.renewed }))
            .sort((a, b) =>
                b.expected - a.expected ||
                b.renewals - a.renewals ||
                b.newLicences - a.newLicences ||
                a.product.localeCompare(b.product, 'tr')
            );

        return NextResponse.json({
            month: selectedMonth,
            currentMonth: monthKey(new Date()),
            summary: trend.find((row) => row.month === selectedMonth),
            products,
            trend,
        }, { status: 200 });
    } catch (error) {
        console.error('Dashboard fetch error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard data', details: error.message },
            { status: 500 }
        );
    }
}
