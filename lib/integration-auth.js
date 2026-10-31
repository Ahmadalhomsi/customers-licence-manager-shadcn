// lib/integration-auth.js - API key check for /api/integration (server-to-server calls from connected systems)
import { createHash, timingSafeEqual } from 'crypto';

// Connected system -> env var holding its API key. One key per system, so each can be revoked on its own.
const SOURCE_KEYS = {
    'app.mapos': 'MAPOS_INTEGRATION_KEY',
    mamenu: 'MAMENU_INTEGRATION_KEY',
    'pos-proxy': 'POS_PROXY_INTEGRATION_KEY',
};

const sha256 = (value) => createHash('sha256').update(value).digest();

/**
 * Returns the system ('app.mapos', 'mamenu', 'pos-proxy') whose key the request sends as
 * "Authorization: Bearer <key>", or null. Systems without a configured key are rejected.
 */
export function getIntegrationSource(req) {
    const header = req.headers.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return null;

    // Compare hashes so the comparison is constant-time and lengths always match
    const sent = sha256(header.slice(7));
    for (const [source, envName] of Object.entries(SOURCE_KEYS)) {
        const key = process.env[envName];
        if (key && timingSafeEqual(sent, sha256(key))) return source;
    }
    return null;
}

export function isIntegrationRequest(req) {
    return getIntegrationSource(req) !== null;
}
