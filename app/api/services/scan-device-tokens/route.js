import { verifyJWT } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

async function findConflictsByField(field) {
    const conflicts = await prisma.service.groupBy({
        by: [field],
        where: {
            [field]: { not: null },
            NOT: { [field]: '' }
        },
        _count: { [field]: true },
        having: {
            [field]: { _count: { gt: 1 } }
        }
    });

    return Promise.all(
        conflicts.map(async (c) => {
            const services = await prisma.service.findMany({
                where: { [field]: c[field] },
                include: {
                    customer: {
                        select: { id: true, name: true }
                    }
                },
                orderBy: { createdAt: 'asc' }
            });

            const uniqueCustomers = new Map();
            services.forEach(s => {
                if (!uniqueCustomers.has(s.customer.id)) {
                    uniqueCustomers.set(s.customer.id, s.customer.name);
                }
            });

            return {
                token: c[field],
                field,
                totalServices: c._count[field],
                totalCustomers: uniqueCustomers.size,
                services: services.map(s => ({
                    id: s.id,
                    name: s.name,
                    companyName: s.companyName,
                    terminal: s.terminal,
                    customerId: s.customer.id,
                    customerName: s.customer.name,
                    deviceToken: s.deviceToken,
                    deviceTokenV2: s.deviceTokenV2,
                    createdAt: s.createdAt,
                    lastLoginDate: s.lastLoginDate,
                    active: s.active
                }))
            };
        })
    );
}

export async function GET(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canViewServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet görüntüleme izniniz yok' }, { status: 403 });
        }

        const v1Conflicts = await findConflictsByField('deviceToken');
        const v2Conflicts = await findConflictsByField('deviceTokenV2');

        const allConflicts = [...v1Conflicts, ...v2Conflicts];

        const crossCustomerConflicts = allConflicts.filter(c => c.totalCustomers > 1);

        return NextResponse.json({
            totalConflicts: crossCustomerConflicts.length,
            conflicts: crossCustomerConflicts,
            allConflicts
        });
    } catch (error) {
        console.error('Device token tarama hatasi:', error);
        return NextResponse.json({ error: 'Tarama sirasinda hata olustu' }, { status: 500 });
    }
}
