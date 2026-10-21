import {
    OAuthTokenError,
    authenticateClient,
    corsPreflight,
    exchangeAuthorizationCode,
    findClient,
    mcpResourceUrl,
    oauthJson,
    refreshAccessToken,
} from '@/lib/oauth';

// Token parameters arrive form-encoded (standard) or as JSON; client credentials in the body or HTTP Basic
async function readParams(req) {
    const contentType = req.headers.get('content-type') || '';
    const params = contentType.includes('application/json')
        ? await req.json()
        : Object.fromEntries(new URLSearchParams(await req.text()));

    const basic = req.headers.get('authorization');
    if (basic?.toLowerCase().startsWith('basic ')) {
        const [id, secret] = Buffer.from(basic.slice(6), 'base64').toString().split(':');
        params.client_id ??= decodeURIComponent(id || '');
        params.client_secret ??= decodeURIComponent(secret || '');
    }
    return params;
}

export async function POST(req) {
    try {
        const params = await readParams(req);
        const client = await findClient(params.client_id);

        if (!authenticateClient(client, params.client_secret)) {
            return oauthJson({ error: 'invalid_client', error_description: 'Unknown client or wrong client secret' }, 401);
        }

        // Tokens are always issued for this server's /api/mcp, whatever resource the client asked for
        const resource = mcpResourceUrl(req);

        if (params.grant_type === 'authorization_code') {
            return oauthJson(await exchangeAuthorizationCode({
                code: params.code,
                client,
                redirectUri: params.redirect_uri,
                codeVerifier: params.code_verifier,
                resource,
            }));
        }

        if (params.grant_type === 'refresh_token') {
            return oauthJson(await refreshAccessToken({ refreshToken: params.refresh_token, client, resource }));
        }

        return oauthJson({ error: 'unsupported_grant_type' }, 400);
    } catch (error) {
        if (error instanceof OAuthTokenError) {
            return oauthJson({ error: error.code, error_description: error.message }, error.status);
        }
        console.error('OAuth token error:', error);
        return oauthJson({ error: 'server_error' }, 500);
    }
}

export const OPTIONS = corsPreflight;
