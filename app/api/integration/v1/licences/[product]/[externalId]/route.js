import { NextResponse } from 'next/server';
import { getIntegrationSource } from '@/lib/integration-auth';
import { deleteIntegrationLicence } from '@/lib/integration-licences';
import { LicenceError } from '@/lib/licences';

export const dynamic = 'force-dynamic';

/**
 * Store, menu or device deleted in a connected system: deactivates and archives its licence.
 *
 * DELETE /api/integration/v1/licences/{product}/{externalId}
 * - 200 with the licence (also when it was already deleted), 404 when there is no licence
 */
export async function DELETE(req, { params }) {
    try {
        const source = getIntegrationSource(req);
        if (!source) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid or missing API key' }, { status: 401 });
        }

        const { product, externalId } = await params;
        const licence = await deleteIntegrationLicence(source, { product, externalId });
        if (!licence) {
            return NextResponse.json({ error: 'LICENCE_NOT_FOUND', message: 'No licence for this id' }, { status: 404 });
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
