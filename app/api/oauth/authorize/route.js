import { NextResponse } from 'next/server';
import { checkAdminCredentials } from '@/lib/admin-auth';
import { createAuthorizationCode, findClient, normalizeScope } from '@/lib/oauth';

// Shared checks for the /oauth/authorize page. An unknown client or unregistered redirect_uri must never be redirected to.
async function validateRequest(params) {
    const client = await findClient(params.client_id);
    if (!client) {
        return { error: 'Bu uygulama tanınmıyor. Bağlantıyı asistandan yeniden başlatın.' };
    }
    if (!client.redirectUris.includes(params.redirect_uri)) {
        return { error: 'Geçersiz yönlendirme adresi.' };
    }
    if (params.response_type !== 'code') {
        return { error: 'Desteklenmeyen istek türü.' };
    }
    if (!params.code_challenge || params.code_challenge_method !== 'S256') {
        return { error: 'Güvenli bağlantı (PKCE S256) gerekli.' };
    }
    return { client };
}

function redirectWith(redirectUri, values) {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(values)) {
        if (value) url.searchParams.set(key, value);
    }
    return url.toString();
}

// GET ?client_id&redirect_uri&response_type&code_challenge&code_challenge_method -> what the consent screen shows
export async function GET(req) {
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const { client, error } = await validateRequest(params);
    if (error) {
        return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({
        clientName: client.name || 'AI asistanı',
        redirectHost: new URL(params.redirect_uri).host,
    });
}

// POST { ...authorize params, decision, username, password } -> { redirect } back to the assistant
export async function POST(req) {
    const params = await req.json();
    const { error } = await validateRequest(params);
    if (error) {
        return NextResponse.json({ error }, { status: 400 });
    }

    if (params.decision !== 'allow') {
        return NextResponse.json({
            redirect: redirectWith(params.redirect_uri, { error: 'access_denied', state: params.state }),
        });
    }

    const result = await checkAdminCredentials(req, params.username, params.password);
    if (result.status === 'blocked') {
        return NextResponse.json(
            { error: 'Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin.' },
            { status: 429 }
        );
    }
    if (result.status !== 'ok') {
        return NextResponse.json({ error: 'Kullanıcı adı veya şifre hatalı.' }, { status: 401 });
    }
    if (!result.admin.canUseAssistant) {
        return NextResponse.json(
            { error: 'Bu hesabın asistan kullanma izni yok. Yöneticinizden "Asistan Kullanabilir" iznini isteyin.' },
            { status: 403 }
        );
    }

    const code = await createAuthorizationCode({
        clientId: params.client_id,
        adminId: result.admin.id,
        redirectUri: params.redirect_uri,
        codeChallenge: params.code_challenge,
        scope: normalizeScope(params.scope),
    });

    return NextResponse.json({ redirect: redirectWith(params.redirect_uri, { code, state: params.state }) });
}
