import { verifyJWT } from '@/lib/jwt';
import { getDashboard } from '@/lib/dashboard';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Monthly licence figures for the dashboard (?month=YYYY-MM, default: current Istanbul month); see lib/dashboard.js
export async function GET(req) {
    try {
        const token = req.cookies.get('token')?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canViewServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet görüntüleme izniniz yok' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        return NextResponse.json(await getDashboard(searchParams.get('month')), { status: 200 });
    } catch (error) {
        console.error('Dashboard fetch error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard data', details: error.message },
            { status: 500 }
        );
    }
}
