import { verifyJWT } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
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

function countDistinctCustomers(items) {
    return new Set(items.map((item) => item.customer)).size;
}

/**
 * Monthly licence figures for the dashboard (?month=YYYY-MM, default: current Istanbul month).
 * - pending:   licences ending in the month that have not been renewed yet
 * - renewed:   licences that were due in the month and have already been renewed
 * - renewals:  renewal operations performed in the month (RenewHistory.createdAt)
 * - newLicences: services created in the month
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
        const [services, renewals] = await Promise.all([
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
        ]);

        const stats = new Map(months.map((key) => [key, {
            pending: new Map(),
            renewed: new Map(),
            renewals: [],
            newLicences: [],
            newTrials: 0,
        }]));

        for (const service of services) {
            const trial = isTrial(service);
            const item = { category: service.category, customer: customerKey(service) };

            const due = stats.get(monthKey(service.endingDate));
            if (due && !trial && !service.archived && service.paymentType !== 'unlimited') {
                due.pending.set(service.id, item);
            }

            const created = stats.get(monthKey(service.createdAt));
            if (created) {
                if (trial) created.newTrials++;
                else created.newLicences.push(item);
            }
        }

        for (const renewal of renewals) {
            if (isTrial(renewal.service)) continue;
            const item = { category: renewal.service.category, customer: customerKey(renewal.service) };

            // A licence still ending in the same month (e.g. a short custom extension) stays pending
            const due = stats.get(monthKey(renewal.previousEndDate));
            if (due && !due.pending.has(renewal.serviceId)) {
                due.renewed.set(renewal.serviceId, item);
            }

            const done = stats.get(monthKey(renewal.createdAt));
            if (done) done.renewals.push(item);
        }

        const trend = months.map((key) => {
            const s = stats.get(key);
            const pending = [...s.pending.values()];
            const renewed = [...s.renewed.values()];
            return {
                month: key,
                pending: pending.length,
                renewed: renewed.length,
                expected: pending.length + renewed.length,
                pendingCustomers: countDistinctCustomers(pending),
                expectedCustomers: countDistinctCustomers([...pending, ...renewed]),
                renewals: s.renewals.length,
                newLicences: s.newLicences.length,
                newTrials: s.newTrials,
            };
        });

        const selected = stats.get(selectedMonth);
        const byCategory = new Map();
        const addToCategories = (items, field) => {
            for (const item of items) {
                const row = byCategory.get(item.category) || { category: item.category, pending: 0, renewed: 0, renewals: 0, newLicences: 0 };
                row[field]++;
                byCategory.set(item.category, row);
            }
        };
        addToCategories(selected.pending.values(), 'pending');
        addToCategories(selected.renewed.values(), 'renewed');
        addToCategories(selected.renewals, 'renewals');
        addToCategories(selected.newLicences, 'newLicences');

        const categories = [...byCategory.values()]
            .map((row) => ({ ...row, expected: row.pending + row.renewed }))
            .sort((a, b) =>
                b.expected - a.expected ||
                b.renewals - a.renewals ||
                b.newLicences - a.newLicences ||
                a.category.localeCompare(b.category, 'tr')
            );

        return NextResponse.json({
            month: selectedMonth,
            currentMonth: monthKey(new Date()),
            summary: trend.find((row) => row.month === selectedMonth),
            categories,
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
