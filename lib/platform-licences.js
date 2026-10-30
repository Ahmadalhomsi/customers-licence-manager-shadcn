// lib/platform-licences.js - Food platform licences created by app.mapos (/api/integration)
import prisma from '@/lib/prisma';
import { ISTANBUL_OFFSET_MS } from '@/lib/dashboard';
import { LicenceError } from '@/lib/licences';

// app.mapos platform key -> service category (same names as the service form)
export const PLATFORM_CATEGORIES = {
    yemeksepeti: 'Yemek Sepeti',
    trendyol: 'Trendyol Yemek',
    migros: 'Migros Yemek',
    getir: 'Getir Yemek',
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

// Midnight Istanbul of the same calendar date next year (how the panel stores a picked date)
function oneYearFromToday(now = new Date()) {
    const today = new Date(now.getTime() + ISTANBUL_OFFSET_MS);
    return new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate()) - ISTANBUL_OFFSET_MS);
}

function toResponse(service, platform, storeId) {
    return {
        id: service.id,
        customerId: service.customerID,
        platform,
        storeId,
        storeName: service.name,
        startingDate: service.startingDate,
        endingDate: service.endingDate,
        active: service.active,
    };
}

function validate(fields) {
    if (!PLATFORM_CATEGORIES[fields.platform]) {
        throw new LicenceError(`platform must be one of: ${Object.keys(PLATFORM_CATEGORIES).join(', ')}`);
    }
    for (const [field, value] of Object.entries(fields)) {
        if (typeof value !== 'string' || !value.trim()) throw new LicenceError(`${field} is required`);
        if (value.length > 100) throw new LicenceError(`${field} is too long (maximum 100 characters)`);
    }
}

/**
 * Creates a 1-year licence for an app.mapos store under the given customer.
 * Idempotent per platform + storeId: a store sent again returns its existing licence (created: false);
 * a deleted (archived) one is restored with its original end date, so re-adding a store gives no free year.
 * Returns null when the customer does not exist.
 */
export async function createPlatformLicence({ customerId, platform, storeId, storeName }) {
    validate({ platform, customerId, storeId, storeName });

    const category = PLATFORM_CATEGORIES[platform];
    const externalId = `${platform}:${storeId.trim()}`;
    const findExisting = () => prisma.service.findUnique({ where: { externalId }, select: LICENCE_SELECT });

    let existing = await findExisting();
    if (existing?.archived) {
        existing = await prisma.service.update({
            where: { id: existing.id },
            data: { archived: false, archivedAt: null, active: true },
            select: LICENCE_SELECT,
        });
    }
    if (existing) return { created: false, licence: toResponse(existing, platform, storeId.trim()) };

    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) return null;

    try {
        const service = await prisma.service.create({
            data: {
                name: storeName.trim(),
                description: `app.mapos mağazası (${externalId})`,
                category,
                paymentType: '1year',
                periodPrice: 0,
                currency: 'TL',
                active: true,
                startingDate: new Date(),
                endingDate: oneYearFromToday(),
                externalId,
                customer: { connect: { id: customer.id } },
            },
            select: LICENCE_SELECT,
        });
        return { created: true, licence: toResponse(service, platform, storeId.trim()) };
    } catch (error) {
        // The same store sent twice at once: the other request created it
        if (error.code === 'P2002') {
            const raced = await findExisting();
            if (raced) return { created: false, licence: toResponse(raced, platform, storeId.trim()) };
        }
        throw error;
    }
}

/**
 * Store deleted in app.mapos: the licence is deactivated and archived, not deleted, so its renewal
 * history and dashboard figures stay. Deleting again is harmless. Returns null when the store has no licence.
 */
export async function deletePlatformLicence({ platform, storeId }) {
    validate({ platform, storeId });

    const externalId = `${platform}:${storeId.trim()}`;
    const existing = await prisma.service.findUnique({ where: { externalId }, select: LICENCE_SELECT });
    if (!existing) return null;

    const service = existing.archived ? existing : await prisma.service.update({
        where: { id: existing.id },
        data: { active: false, archived: true, archivedAt: new Date() },
        select: LICENCE_SELECT,
    });
    return toResponse(service, platform, storeId.trim());
}
