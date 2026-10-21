import { SUPPORTED_SCOPES, corsPreflight, getBaseUrl, oauthJson } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

// RFC 8414 authorization server metadata, read by assistants before they start the sign-in flow
export async function GET(req) {
    const base = getBaseUrl(req);
    return oauthJson({
        issuer: base,
        authorization_endpoint: `${base}/oauth/authorize`,
        token_endpoint: `${base}/api/oauth/token`,
        registration_endpoint: `${base}/api/oauth/register`,
        scopes_supported: SUPPORTED_SCOPES,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    });
}

export const OPTIONS = corsPreflight;
