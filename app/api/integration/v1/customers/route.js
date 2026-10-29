import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isIntegrationRequest } from '@/lib/integration-auth';
import { findIdsByTurkishSearch } from '@/lib/turkish-search';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

/**
 * Customer list for app.mapos, used to link a new store to the right customer.
 *
 * GET /api/integration/v1/customers?search=&page=&limit=
 * - search (optional): name, sign board, phone or email; case- and Turkish-character-insensitive
 * - Without page and limit, returns every matching customer at once (e.g. for an autocomplete)
 * - With page and/or limit, returns that page plus pagination info
 */
export async function GET(req) {
    try {
        if (!isIntegrationRequest(req)) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid or missing API key' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const paged = searchParams.has('page') || searchParams.has('limit');
        const page = Math.max(parseInt(searchParams.get('page')) || 1, 1);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT);
        const search = (searchParams.get('search') || '').trim();

        // Placeholder customers created by trial validation are not real customers
        const where = { name: { not: 'Trial Customer' } };
        if (search) {
            where.id = { in: await findIdsByTurkishSearch('Customer', ['name', 'signBoard', 'phone', 'email'], search) };
        }

        const [total, customers] = await Promise.all([
            prisma.customer.count({ where }),
            prisma.customer.findMany({
                where,
                select: { id: true, name: true, signBoard: true },
                orderBy: [{ name: 'asc' }, { id: 'asc' }],
                ...(paged && { skip: (page - 1) * limit, take: limit }),
            }),
        ]);

        return NextResponse.json({
            customers,
            total,
            ...(paged && { pagination: { page, limit, totalPages: Math.ceil(total / limit) } }),
        });
    } catch (error) {
        console.error('Integration customer list failed:', error);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to list customers' }, { status: 500 });
    }
}
