import { verifyJWT } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canEditServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet düzenleme izniniz yok' }, { status: 403 });
        }

        const { migrations } = await req.json();

        if (!migrations || !Array.isArray(migrations) || migrations.length === 0) {
            return NextResponse.json({ error: 'Geçersiz migrasyon verisi' }, { status: 400 });
        }

        const results = [];

        for (const m of migrations) {
            const { deviceToken: v1Token, deviceTokenV2: v2Token } = m;

            if (!v1Token || !v2Token) {
                results.push({ v1Token, status: 'skipped', reason: 'Eksik token bilgisi' });
                continue;
            }

            const service = await prisma.service.findFirst({
                where: { deviceToken: v1Token }
            });

            if (!service) {
                results.push({ v1Token, v2Token, status: 'skipped', reason: 'Servis bulunamadi' });
                continue;
            }

            if (service.deviceTokenV2 === v2Token) {
                results.push({ v1Token, v2Token, serviceId: service.id, status: 'unchanged', reason: 'Zaten migre edilmis' });
                continue;
            }

            await prisma.service.update({
                where: { id: service.id },
                data: { deviceTokenV2: v2Token }
            });

            results.push({ v1Token, v2Token, serviceId: service.id, status: 'migrated' });
        }

        const migrated = results.filter(r => r.status === 'migrated').length;
        const unchanged = results.filter(r => r.status === 'unchanged').length;
        const skipped = results.filter(r => r.status === 'skipped').length;

        return NextResponse.json({
            total: migrations.length,
            migrated,
            unchanged,
            skipped,
            results
        });
    } catch (error) {
        console.error('Token migrasyon hatasi:', error);
        return NextResponse.json({ error: 'Migrasyon sirasinda hata olustu' }, { status: 500 });
    }
}
