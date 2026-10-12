import { verifyJWT } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { addMonths } from 'date-fns';

// Renewal type -> number of months to add (same types used by RenewHistory)
const EXTEND_PERIODS = {
    '1month': 1,
    '6months': 6,
    '1year': 12,
    '2years': 24,
    '3years': 36,
};

/**
 * Bulk-extends licences: moves each service's endingDate forward by the chosen period,
 * or to a chosen date when period is 'custom' (body: { period: 'custom', endingDate }).
 * startingDate is never touched. A RenewHistory row is written for every extended service.
 * Unlimited services, and services whose end date is already on/after the custom date, are skipped.
 */
export async function POST(req) {
    try {
        const token = req.cookies.get('token')?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canEditServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet güncelleme izniniz yok' }, { status: 403 });
        }

        const data = await req.json();
        const serviceIds = Array.isArray(data?.serviceIds) ? [...new Set(data.serviceIds.filter(Boolean))] : [];
        const period = data?.period || '1year';
        const isCustom = period === 'custom';
        const months = EXTEND_PERIODS[period];
        const customEndDate = isCustom ? new Date(data?.endingDate) : null;

        if (serviceIds.length === 0) {
            return NextResponse.json({ error: 'serviceIds alanı zorunludur' }, { status: 400 });
        }

        if (!isCustom && !months) {
            return NextResponse.json({ error: 'Geçersiz uzatma süresi' }, { status: 400 });
        }

        if (isCustom && (!data?.endingDate || Number.isNaN(customEndDate.getTime()))) {
            return NextResponse.json({ error: 'Geçerli bir bitiş tarihi seçin' }, { status: 400 });
        }

        const services = await prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true, endingDate: true, paymentType: true },
        });

        const limited = services.filter((service) => service.paymentType !== 'unlimited');
        const skippedUnlimited = services.length - limited.length;

        // A custom date must move the end date forward; never shorten a licence here.
        const toExtend = isCustom
            ? limited.filter((service) => new Date(service.endingDate) < customEndDate)
            : limited;
        const skippedNotLater = limited.length - toExtend.length;

        const operations = toExtend.flatMap((service) => {
            const previousEndDate = new Date(service.endingDate);
            const newEndDate = isCustom ? customEndDate : addMonths(previousEndDate, months);

            return [
                prisma.service.update({
                    where: { id: service.id },
                    data: { endingDate: newEndDate },
                }),
                prisma.renewHistory.create({
                    data: {
                        name: `${service.name} için Yenileme`,
                        type: period,
                        previousEndDate,
                        newEndDate,
                        serviceId: service.id,
                    },
                }),
            ];
        });

        if (operations.length > 0) {
            await prisma.$transaction(operations);
        }

        return NextResponse.json({
            message: `${toExtend.length} hizmet uzatıldı`,
            extendedCount: toExtend.length,
            skippedUnlimited,
            skippedNotLater,
            notFound: serviceIds.length - services.length,
        }, { status: 200 });
    } catch (error) {
        console.error('Bulk extend error:', error);
        return NextResponse.json({ error: 'Hizmetler uzatılırken hata oluştu' }, { status: 500 });
    }
}
