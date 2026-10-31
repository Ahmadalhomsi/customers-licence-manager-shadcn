import { NextResponse } from 'next/server';
import { getIntegrationSource } from '@/lib/integration-auth';
import { createIntegrationLicence } from '@/lib/integration-licences';
import { LicenceError } from '@/lib/licences';

export const dynamic = 'force-dynamic';

/**
 * Creates the licence for a store, menu or device created in a connected system.
 *
 * POST /api/integration/v1/licences
 * { "customerId": "...", "product": "...", "externalId": "...", "name": "..." }
 * (app.mapos sends platform / storeId / storeName)
 * - 201 with the new 1-year licence, or 200 with the existing one when it was already sent
 */
export async function POST(req) {
    try {
        const source = getIntegrationSource(req);
        if (!source) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid or missing API key' }, { status: 401 });
        }

        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'INVALID_BODY', message: 'Body must be JSON' }, { status: 400 });
        }

        const result = await createIntegrationLicence(source, body || {});
        if (!result) {
            return NextResponse.json({ error: 'CUSTOMER_NOT_FOUND', message: 'No customer with this customerId' }, { status: 404 });
        }

        return NextResponse.json({ created: result.created, licence: result.licence }, { status: result.created ? 201 : 200 });
    } catch (error) {
        if (error instanceof LicenceError) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: error.message }, { status: 400 });
        }
        console.error('Integration licence creation failed:', error);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to create licence' }, { status: 500 });
    }
}
