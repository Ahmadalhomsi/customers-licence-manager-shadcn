import { verifyJWT } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canViewServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet görüntüleme izniniz yok' }, { status: 403 });
        }

        const conflicts = await prisma.service.groupBy({
            by: ['deviceToken'],
            where: {
                deviceToken: { not: null },
                NOT: { deviceToken: '' }
            },
            _count: { deviceToken: true },
            _min: { id: true },
            having: {
                deviceToken: { _count: { gt: 1 } }
            }
        });

        const conflictDetails = await Promise.all(
            conflicts.map(async (c) => {
                const services = await prisma.service.findMany({
                    where: { deviceToken: c.deviceToken },
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
                    deviceToken: c.deviceToken,
                    totalServices: c._count.deviceToken,
                    totalCustomers: uniqueCustomers.size,
                    services: services.map(s => ({
                        id: s.id,
                        name: s.name,
                        companyName: s.companyName,
                        terminal: s.terminal,
                        customerId: s.customer.id,
                        customerName: s.customer.name,
                        createdAt: s.createdAt,
                        lastLoginDate: s.lastLoginDate,
                        active: s.active
                    }))
                };
            })
        );

        const crossCustomerConflicts = conflictDetails.filter(c => c.totalCustomers > 1);

        return NextResponse.json({
            totalConflicts: crossCustomerConflicts.length,
            conflicts: crossCustomerConflicts,
            allConflicts: conflictDetails
        });
    } catch (error) {
        console.error('Device token tarama hatasi:', error);
        return NextResponse.json({ error: 'Tarama sirasinda hata olustu' }, { status: 500 });
    }
}
