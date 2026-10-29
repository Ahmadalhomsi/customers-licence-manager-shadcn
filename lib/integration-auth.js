// lib/integration-auth.js - API key check for /api/integration (server-to-server calls from app.mapos)
import { createHash, timingSafeEqual } from 'crypto';

const sha256 = (value) => createHash('sha256').update(value).digest();

/**
 * True when the request sends "Authorization: Bearer <MAPOS_INTEGRATION_KEY>".
 * Fails closed: without MAPOS_INTEGRATION_KEY every request is rejected.
 */
export function isIntegrationRequest(req) {
    const key = process.env.MAPOS_INTEGRATION_KEY;
    if (!key) {
        console.warn('MAPOS_INTEGRATION_KEY is not set: /api/integration rejects every request');
        return false;
    }

    const header = req.headers.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return false;

    // Compare hashes so the comparison is constant-time and lengths always match
    return timingSafeEqual(sha256(header.slice(7)), sha256(key));
}
