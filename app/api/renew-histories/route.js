import prisma from '@/lib/prisma';  // Import the prisma instance from the file
import { NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

// app/api/renew-history/route.js
export async function GET(request) {
    try {
        const token = request.cookies.get('token')?.value;
        const decoded = await verifyJWT(token);

        if (!decoded.permissions.canViewServices) {
            return NextResponse.json({ error: 'Yasak: Hizmet görüntüleme izniniz yok' }, { status: 403 });
        }

        const histories = await prisma.renewHistory.findMany()

        return NextResponse.json(histories)
    } catch (error) {
        console.error('Renew history fetch error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch renew histories' }, { status: 500 });
    }
}
