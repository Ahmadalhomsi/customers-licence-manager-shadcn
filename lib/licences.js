// lib/licences.js - Licence (service) operations shared by the web API and the AI assistant
import prisma from '@/lib/prisma';
import { ISTANBUL_OFFSET_MS } from '@/lib/dashboard';
import { EXTEND_BASES, EXTEND_PERIODS, newEndDateFor } from '@/lib/licence-extend';

export { EXTEND_BASES, EXTEND_PERIODS, newEndDateFor };

const DAY_MS = 24 * 60 * 60 * 1000;

// Panel convention for "Sınırsız" licences (same value as the service routes and modals)
export const UNLIMITED_END_DATE = new Date('9999-12-31T00:00:00.000Z');

// Validation problem the caller should report back as a 400 / tool error
export class LicenceError extends Error {}

// Istanbul calendar date, "2026-10-20"
export function istanbulDate(date) {
    return new Date(new Date(date).getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);
}

// Calendar days left in Istanbul time (0 = ends today, negative = expired); null for unlimited licences
export function remainingDays(service, now = new Date()) {
    if (service.paymentType === 'unlimited') return null;
    const dayIndex = (date) => Math.floor((new Date(date).getTime() + ISTANBUL_OFFSET_MS) / DAY_MS);
    return dayIndex(service.endingDate) - dayIndex(now);
}

/**
 * Moves each service's endingDate forward by the chosen period, or to a chosen date when period is 'custom'.
 * base 'end' (default) adds the period to the current end date; base 'start' moves the end to the next
 * start-date anniversary after the current end (see newEndDateFor in lib/licence-extend.js).
 * startingDate is never touched. A RenewHistory row is written for every extended service.
 * Unlimited services, and services whose new end date would not be later than the current one, are skipped.
 */
export async function extendServices({ serviceIds, period = '1year', endingDate, base = 'end' }) {
    const ids = Array.isArray(serviceIds) ? [...new Set(serviceIds.filter(Boolean))] : [];
    const isCustom = period === 'custom';
    const months = EXTEND_PERIODS[period];
    const customEndDate = isCustom ? new Date(endingDate) : null;

    if (ids.length === 0) {
        throw new LicenceError('serviceIds alanı zorunludur');
    }
    if (!isCustom && !months) {
        throw new LicenceError('Geçersiz uzatma süresi');
    }
    if (isCustom && (!endingDate || Number.isNaN(customEndDate.getTime()))) {
        throw new LicenceError('Geçerli bir bitiş tarihi seçin');
    }
    if (!EXTEND_BASES.includes(base)) {
        throw new LicenceError('Geçersiz uzatma başlangıcı');
    }

    const services = await prisma.service.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, startingDate: true, endingDate: true, paymentType: true },
    });

    const limited = services.filter((service) => service.paymentType !== 'unlimited');

    // The end date must move forward; never shorten a licence here.
    const extended = limited.flatMap((service) => {
        const previousEndDate = new Date(service.endingDate);
        const newEndDate = newEndDateFor(service, { period, base, customEndDate });
        if (!newEndDate || newEndDate <= previousEndDate) return [];
        return [{ id: service.id, name: service.name, previousEndDate, newEndDate }];
    });

    const operations = extended.flatMap((service) => [
        prisma.service.update({
            where: { id: service.id },
            data: { endingDate: service.newEndDate },
        }),
        prisma.renewHistory.create({
            data: {
                name: `${service.name} için Yenileme`,
                type: period,
                previousEndDate: service.previousEndDate,
                newEndDate: service.newEndDate,
                serviceId: service.id,
            },
        }),
    ]);

    if (operations.length > 0) {
        await prisma.$transaction(operations);
    }

    return {
        extended,
        skippedUnlimited: services.length - limited.length,
        skippedNotLater: limited.length - extended.length,
        notFound: ids.length - services.length,
    };
}

/**
 * Turns licences into "Sınırsız" the way the service edit form does: paymentType 'unlimited' and the
 * far-future end date. Like the panel, no RenewHistory row is written for a switch to unlimited.
 */
export async function makeServicesUnlimited(serviceIds) {
    const ids = Array.isArray(serviceIds) ? [...new Set(serviceIds.filter(Boolean))] : [];
    if (ids.length === 0) {
        throw new LicenceError('serviceIds alanı zorunludur');
    }

    const services = await prisma.service.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, endingDate: true, paymentType: true },
    });
    const limited = services.filter((service) => service.paymentType !== 'unlimited');

    if (limited.length > 0) {
        await prisma.service.updateMany({
            where: { id: { in: limited.map((service) => service.id) } },
            data: { paymentType: 'unlimited', endingDate: UNLIMITED_END_DATE },
        });
    }

    return {
        changed: limited.map((service) => ({
            id: service.id,
            name: service.name,
            previousEndDate: service.endingDate,
            previousPaymentType: service.paymentType,
        })),
        alreadyUnlimited: services.length - limited.length,
        notFound: ids.length - services.length,
    };
}
