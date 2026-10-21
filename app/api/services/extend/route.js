import { verifyJWT } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { extendServices, LicenceError } from '@/lib/licences';

/**
 * Bulk-extends licences: moves each service's endingDate forward by the chosen period,
 * or to a chosen date when period is 'custom' (body: { period: 'custom', endingDate }).
 * See extendServices in lib/licences.js for the rules.
 */
export async function POST(req) {
    try {
        const token = req.cookies.get('token')?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canEditServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet güncelleme izniniz yok' }, { status: 403 });
        }

        const data = await req.json();
        const result = await extendServices({
            serviceIds: data?.serviceIds,
            period: data?.period || '1year',
            endingDate: data?.endingDate,
        });

        return NextResponse.json({
            message: `${result.extended.length} hizmet uzatıldı`,
            extendedCount: result.extended.length,
            skippedUnlimited: result.skippedUnlimited,
            skippedNotLater: result.skippedNotLater,
            notFound: result.notFound,
        }, { status: 200 });
    } catch (error) {
        if (error instanceof LicenceError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        console.error('Bulk extend error:', error);
        return NextResponse.json({ error: 'Hizmetler uzatılırken hata oluştu' }, { status: 500 });
    }
}
