import { verifyJWT } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Distinct service categories with row counts, used by the services filter dropdown.
// Runs as a single indexed GROUP BY so the dropdown lists every category in the
// table, not just the rows on the currently displayed page.
export async function GET(req) {
    try {
        const token = req.cookies.get('token')?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canViewServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet görüntüleme izniniz yok' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        // The archive page filters within archived services only
        const archiveOnly = searchParams.get('archive') === 'true';

        const grouped = await prisma.service.groupBy({
            by: ['category'],
            _count: { _all: true },
            where: { archived: archiveOnly }
        });

        const categories = grouped
            .map((row) => ({
                category: row.category || 'Adisyon Programı',
                count: row._count._all
            }))
            // Most used categories first, then Turkish-alphabetical
            .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'tr'));

        return NextResponse.json({ categories }, { status: 200 });
    } catch (error) {
        console.error('Service categories fetch error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch service categories', details: error.message },
            { status: 500 }
        );
    }
}
