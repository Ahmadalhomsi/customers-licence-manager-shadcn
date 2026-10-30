import { NextResponse } from 'next/server';
import { isIntegrationRequest } from '@/lib/integration-auth';
import { deletePlatformLicence } from '@/lib/platform-licences';
import { LicenceError } from '@/lib/licences';

export const dynamic = 'force-dynamic';

/**
 * Store deleted in app.mapos: deactivates and archives its licence.
 *
 * DELETE /api/integration/v1/licences/{platform}/{storeId}
 * - 200 with the licence (also when it was already deleted), 404 when the store has no licence
 */
export async function DELETE(req, { params }) {
    try {
        if (!isIntegrationRequest(req)) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid or missing API key' }, { status: 401 });
        }

        const { platform, storeId } = await params;
        const licence = await deletePlatformLicence({ platform, storeId });
        if (!licence) {
            return NextResponse.json({ error: 'LICENCE_NOT_FOUND', message: 'No licence for this store' }, { status: 404 });
        }

        return NextResponse.json({ deleted: true, licence });
    } catch (error) {
        if (error instanceof LicenceError) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: error.message }, { status: 400 });
        }
        console.error('Integration licence deletion failed:', error);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to delete licence' }, { status: 500 });
    }
}
