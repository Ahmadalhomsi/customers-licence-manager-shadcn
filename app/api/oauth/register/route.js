import { corsPreflight, isAllowedRedirectUri, oauthJson, registerClient } from '@/lib/oauth';

/**
 * RFC 7591 dynamic client registration. Assistants register themselves once; a registered client
 * gets nothing by itself, since an admin still has to sign in and approve on /oauth/authorize.
 * Redirect URIs are limited to known assistant hosts (see isAllowedRedirectUri).
 */
export async function POST(req) {
    let body;
    try {
        body = await req.json();
    } catch {
        return oauthJson({ error: 'invalid_client_metadata', error_description: 'Body must be JSON' }, 400);
    }

    const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((uri) => typeof uri === 'string') : [];
    if (redirectUris.length === 0 || redirectUris.length > 5) {
        return oauthJson({ error: 'invalid_redirect_uri', error_description: 'Provide 1 to 5 redirect_uris' }, 400);
    }
    const rejected = redirectUris.find((uri) => !isAllowedRedirectUri(uri));
    if (rejected) {
        return oauthJson({ error: 'invalid_redirect_uri', error_description: `Redirect URI not allowed: ${rejected}` }, 400);
    }

    const authMethod = ['client_secret_post', 'client_secret_basic'].includes(body.token_endpoint_auth_method)
        ? body.token_endpoint_auth_method
        : 'none';

    const { client, clientSecret } = await registerClient({
        name: body.client_name,
        redirectUris,
        withSecret: authMethod !== 'none',
    });

    return oauthJson({
        client_id: client.id,
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.name ?? undefined,
        redirect_uris: client.redirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: authMethod,
    }, 201);
}

export const OPTIONS = corsPreflight;
