// lib/integration-licences.js - Licences created by connected systems (/api/integration):
// app.mapos food platform stores, MaMenu menus and POS proxy devices
import prisma from '@/lib/prisma';
import { ISTANBUL_OFFSET_MS } from '@/lib/dashboard';
import { LicenceError } from '@/lib/licences';
import { MAMENU_CATEGORY, POS_PROVIDERS } from '@/lib/licence-products';

// What each system may create: product key -> service category.
// Service.externalId = `${prefix(product)}:${the system's own id}`, unique across systems.
const SOURCES = {
    'app.mapos': {
        description: 'app.mapos mağazası',
        products: { yemeksepeti: 'Yemek Sepeti', trendyol: 'Trendyol Yemek', migros: 'Migros Yemek', getir: 'Getir Yemek' },
        // Live before the other systems were connected: ids stay "<platform>:<storeId>"
        prefix: (product) => product,
        // app.mapos calls the fields platform / storeId / storeName
        legacyFields: true,
    },
    mamenu: {
        description: 'MaMenu menüsü',
        products: { mamenu: MAMENU_CATEGORY },
        prefix: () => 'mamenu',
    },
    'pos-proxy': {
        description: 'POS Proxy cihazı',
        products: Object.fromEntries(POS_PROVIDERS.map((provider) => [provider.key, provider.category])),
        // Serial numbers are only unique per provider
        prefix: (product) => `pos-proxy:${product}`,
    },
};

const LICENCE_SELECT = {
    id: true,
    customerID: true,
    name: true,
    category: true,
    externalId: true,
    startingDate: true,
    endingDate: true,
    active: true,
    archived: true,
};

// Midnight Istanbul of the same calendar date one year after `start` (how the panel stores a picked date)
function oneYearAfter(start) {
    const day = new Date(start.getTime() + ISTANBUL_OFFSET_MS);
    return new Date(Date.UTC(day.getUTCFullYear() + 1, day.getUTCMonth(), day.getUTCDate()) - ISTANBUL_OFFSET_MS);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Optional startingDate for licences synced late: "2026-10-15" (Istanbul calendar date, stored as midnight Istanbul)
 * or an ISO 8601 time with a time zone ("2026-10-15T14:30:00+03:00"). Defaults to now; future dates are rejected.
 */
function readStartingDate(value, now = new Date()) {
    if (value === undefined || value === null || value === '') return now;

    let date = null;
    const dateOnly = typeof value === 'string' && value.match(DATE_ONLY);
    if (dateOnly) {
        const [, year, month, day] = dateOnly.map(Number);
        date = new Date(Date.UTC(year, month - 1, day) - ISTANBUL_OFFSET_MS);
        // Rejects days that roll over, such as 2026-02-30
        if (new Date(date.getTime() + ISTANBUL_OFFSET_MS).getUTCDate() !== day) date = null;
    } else if (typeof value === 'string' && DATE_TIME.test(value)) {
        date = new Date(value);
    }

    if (!date || Number.isNaN(date.getTime())) {
        throw new LicenceError('startingDate must be a date like 2026-10-15 or an ISO 8601 time with a time zone');
    }
    if (date > now) throw new LicenceError('startingDate cannot be in the future');
    return date;
}

/**
 * Reads { product, externalId, name } (app.mapos: { platform, storeId, storeName }) and checks them.
 * Error messages use the field names the calling system sends.
 */
function readInput(source, input, required) {
    const config = SOURCES[source];
    const names = config.legacyFields
        ? { product: 'platform', externalId: 'storeId', name: 'storeName' }
        : { product: 'product', externalId: 'externalId', name: 'name' };
    const fields = {
        product: input.product ?? input.platform,
        customerId: input.customerId,
        externalId: input.externalId ?? input.storeId,
        name: input.name ?? input.storeName,
    };

    if (!config.products[fields.product]) {
        throw new LicenceError(`${names.product} must be one of: ${Object.keys(config.products).join(', ')}`);
    }
    for (const field of required) {
        const value = fields[field];
        const label = names[field] || field;
        if (typeof value !== 'string' || !value.trim()) throw new LicenceError(`${label} is required`);
        if (value.length > 100) throw new LicenceError(`${label} is too long (maximum 100 characters)`);
        fields[field] = value.trim();
    }

    return {
        config,
        ...fields,
        category: config.products[fields.product],
        storedId: `${config.prefix(fields.product)}:${fields.externalId}`,
    };
}

function toResponse(service, { config, product, externalId }) {
    const licence = {
        id: service.id,
        customerId: service.customerID,
        product,
        externalId,
        name: service.name,
        startingDate: service.startingDate,
        endingDate: service.endingDate,
        active: service.active,
    };
    if (config.legacyFields) {
        Object.assign(licence, { platform: product, storeId: externalId, storeName: service.name });
    }
    return licence;
}

/**
 * Creates a 1-year licence for a store / menu / device under the given customer, starting now or on input.startingDate.
 * Idempotent per product + externalId: sent again, the existing licence is returned (created: false);
 * a deleted (archived) one is restored with its original end date, so re-adding gives no free year.
 * Returns null when the customer does not exist.
 */
export async function createIntegrationLicence(source, input) {
    const fields = readInput(source, input, ['customerId', 'externalId', 'name']);
    const startingDate = readStartingDate(input.startingDate);
    const findExisting = () => prisma.service.findUnique({ where: { externalId: fields.storedId }, select: LICENCE_SELECT });

    let existing = await findExisting();
    if (existing?.archived) {
        existing = await prisma.service.update({
            where: { id: existing.id },
            data: { archived: false, archivedAt: null, active: true },
            select: LICENCE_SELECT,
        });
    }
    if (existing) return { created: false, licence: toResponse(existing, fields) };

    const customer = await prisma.customer.findUnique({
        where: { id: fields.customerId },
        select: { id: true, name: true, signBoard: true },
    });
    if (!customer) return null;

    try {
        const service = await prisma.service.create({
            data: {
                name: fields.name,
                description: `${fields.config.description} (${fields.storedId})`,
                // İşletme Adı: the customer's sign board, or the customer name when it has none
                companyName: customer.signBoard?.trim() || customer.name,
                category: fields.category,
                paymentType: '1year',
                periodPrice: 0,
                currency: 'TL',
                active: true,
                startingDate,
                endingDate: oneYearAfter(startingDate),
                externalId: fields.storedId,
                customer: { connect: { id: customer.id } },
            },
            select: LICENCE_SELECT,
        });
        return { created: true, licence: toResponse(service, fields) };
    } catch (error) {
        // The same store/device sent twice at once: the other request created it
        if (error.code === 'P2002') {
            const raced = await findExisting();
            if (raced) return { created: false, licence: toResponse(raced, fields) };
        }
        throw error;
    }
}

/**
 * Store / menu / device deleted in the connected system: the licence is deactivated and archived, not deleted,
 * so its renewal history and dashboard figures stay. Deleting again is harmless. Returns null when there is no licence.
 */
export async function deleteIntegrationLicence(source, input) {
    const fields = readInput(source, input, ['externalId']);

    const existing = await prisma.service.findUnique({ where: { externalId: fields.storedId }, select: LICENCE_SELECT });
    if (!existing) return null;

    const service = existing.archived ? existing : await prisma.service.update({
        where: { id: existing.id },
        data: { active: false, archived: true, archivedAt: new Date() },
        select: LICENCE_SELECT,
    });
    return toResponse(service, fields);
}
