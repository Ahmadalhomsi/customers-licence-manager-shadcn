import { SUPPORTED_SCOPES, corsPreflight, getBaseUrl, mcpResourceUrl, oauthJson } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

// RFC 9728 protected resource metadata for /api/mcp; the 401 from /api/mcp points assistants here
export async function GET(req) {
    return oauthJson({
        resource: mcpResourceUrl(req),
        authorization_servers: [getBaseUrl(req)],
        scopes_supported: SUPPORTED_SCOPES,
        bearer_methods_supported: ['header'],
        resource_name: 'MAPOS Lisans Yönetimi',
    });
}

export const OPTIONS = corsPreflight;
