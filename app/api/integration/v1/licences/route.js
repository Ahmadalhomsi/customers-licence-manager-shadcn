import { NextResponse } from 'next/server';
import { isIntegrationRequest } from '@/lib/integration-auth';
import { createPlatformLicence } from '@/lib/platform-licences';
import { LicenceError } from '@/lib/licences';

export const dynamic = 'force-dynamic';

/**
 * Creates the licence for a store created in app.mapos.
 *
 * POST /api/integration/v1/licences
 * { "customerId": "...", "platform": "yemeksepeti|trendyol|migros|getir", "storeId": "...", "storeName": "..." }
 * - 201 with the new 1-year licence, or 200 with the existing one when the store was already sent
 */
export async function POST(req) {
    try {
        if (!isIntegrationRequest(req)) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid or missing API key' }, { status: 401 });
        }

        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'INVALID_BODY', message: 'Body must be JSON' }, { status: 400 });
        }

        const result = await createPlatformLicence(body || {});
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
