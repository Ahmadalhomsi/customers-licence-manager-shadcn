// lib/oauth.js - Small OAuth 2.1 authorization server so AI assistants (ChatGPT, Claude) can call /api/mcp
// on behalf of an admin. Flow: dynamic client registration -> /oauth/authorize (admin signs in) ->
// /api/oauth/token (PKCE) -> short-lived access token + rotating refresh token.
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getPublicOrigin } from 'mcp-handler';
import prisma from '@/lib/prisma';
import { PERMISSION_FIELDS } from '@/lib/jwt';

export const MCP_SCOPE = 'licences';
export const SUPPORTED_SCOPES = [MCP_SCOPE, 'offline_access'];

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;

// Assistants allowed to receive authorization codes; override with MCP_REDIRECT_HOSTS="chatgpt.com,claude.ai,localhost"
const DEFAULT_REDIRECT_HOSTS = ['chatgpt.com', 'chat.openai.com', 'claude.ai', 'claude.com'];

// OAuth endpoints are called by the assistant's servers or by browser-based tools (e.g. MCP Inspector); no cookies involved
export const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
    'Access-Control-Max-Age': '86400',
};

export function corsPreflight() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function oauthJson(body, status = 200) {
    return Response.json(body, { status, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } });
}

export class OAuthTokenError extends Error {
    constructor(code, description, status = 400) {
        super(description);
        this.code = code;
        this.status = status;
    }
}

// Public base URL: APP_URL when set, otherwise derived from the (reverse proxy) request headers
export function getBaseUrl(req) {
    return (process.env.APP_URL || getPublicOrigin(req)).replace(/\/$/, '');
}

export function mcpResourceUrl(req) {
    return `${getBaseUrl(req)}/api/mcp`;
}

// Access tokens use a key derived from JWT_SECRET, so a web login token never works as an assistant token or vice versa
function accessTokenKey() {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
    return crypto.createHmac('sha256', process.env.JWT_SECRET).update('mcp-access-token').digest();
}

export function randomToken() {
    return crypto.randomBytes(32).toString('base64url');
}

export function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function sameSecret(a, b) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function isAllowedRedirectUri(uri) {
    let url;
    try {
        url = new URL(uri);
    } catch {
        return false;
    }
    const hosts = process.env.MCP_REDIRECT_HOSTS
        ? process.env.MCP_REDIRECT_HOSTS.split(',').map((host) => host.trim()).filter(Boolean)
        : DEFAULT_REDIRECT_HOSTS;

    if (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) {
        return hosts.includes('localhost');
    }
    return url.protocol === 'https:' && hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

// Requested scopes limited to what we support; the licence scope is always granted
export function normalizeScope(requested) {
    const scopes = new Set((requested || '').split(' ').filter((scope) => SUPPORTED_SCOPES.includes(scope)));
    scopes.add(MCP_SCOPE);
    return [...scopes].join(' ');
}

export function canUseAssistant(admin) {
    return Boolean(admin?.active && admin.canUseAssistant);
}

export async function findClient(clientId) {
    if (!clientId) return null;
    return prisma.oAuthClient.findUnique({ where: { id: clientId } });
}

export async function registerClient({ name, redirectUris, withSecret }) {
    const clientSecret = withSecret ? randomToken() : null;
    const client = await prisma.oAuthClient.create({
        data: {
            name: name ? String(name).slice(0, 100) : null,
            redirectUris,
            clientSecretHash: clientSecret ? sha256(clientSecret) : null,
        },
    });
    return { client, clientSecret };
}

// Public clients (no secret) rely on PKCE; clients registered with a secret must present it
export function authenticateClient(client, clientSecret) {
    if (!client) return false;
    if (!client.clientSecretHash) return true;
    return Boolean(clientSecret) && sameSecret(sha256(clientSecret), client.clientSecretHash);
}

export async function createAuthorizationCode({ clientId, adminId, redirectUri, codeChallenge, scope }) {
    const code = randomToken();
    await prisma.oAuthAuthCode.create({
        data: {
            codeHash: sha256(code),
            clientId,
            adminId,
            redirectUri,
            codeChallenge,
            scope,
            expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
        },
    });
    return code;
}

const ADMIN_TOKEN_SELECT = {
    id: true,
    username: true,
    name: true,
    active: true,
    ...Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, true])),
};

async function issueTokens({ adminId, clientId, scope, resource }) {
    const accessToken = jwt.sign(
        { sub: adminId, client_id: clientId, scope },
        accessTokenKey(),
        { expiresIn: ACCESS_TOKEN_TTL_SECONDS, audience: resource }
    );

    const refreshToken = randomToken();
    await prisma.oAuthRefreshToken.create({
        data: {
            tokenHash: sha256(refreshToken),
            clientId,
            adminId,
            scope,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
    });

    return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: refreshToken,
        scope,
    };
}

export async function exchangeAuthorizationCode({ code, client, redirectUri, codeVerifier, resource }) {
    const stored = code ? await prisma.oAuthAuthCode.findUnique({ where: { codeHash: sha256(code) } }) : null;

    if (!stored || stored.clientId !== client.id || stored.expiresAt < new Date()) {
        throw new OAuthTokenError('invalid_grant', 'Authorization code is invalid or expired');
    }
    if (stored.redirectUri !== redirectUri) {
        throw new OAuthTokenError('invalid_grant', 'redirect_uri does not match');
    }
    const challenge = codeVerifier ? crypto.createHash('sha256').update(codeVerifier).digest('base64url') : '';
    if (!sameSecret(challenge, stored.codeChallenge)) {
        throw new OAuthTokenError('invalid_grant', 'PKCE verification failed');
    }

    // Single use: only the first exchange flips usedAt
    const { count } = await prisma.oAuthAuthCode.updateMany({
        where: { id: stored.id, usedAt: null },
        data: { usedAt: new Date() },
    });
    if (count !== 1) {
        throw new OAuthTokenError('invalid_grant', 'Authorization code was already used');
    }

    const admin = await prisma.admin.findUnique({ where: { id: stored.adminId }, select: ADMIN_TOKEN_SELECT });
    if (!canUseAssistant(admin)) {
        throw new OAuthTokenError('invalid_grant', 'This account may not use the assistant');
    }

    return issueTokens({ adminId: admin.id, clientId: client.id, scope: stored.scope, resource });
}

export async function refreshAccessToken({ refreshToken, client, resource }) {
    const stored = refreshToken
        ? await prisma.oAuthRefreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } })
        : null;

    if (!stored || stored.clientId !== client.id || stored.expiresAt < new Date()) {
        throw new OAuthTokenError('invalid_grant', 'Refresh token is invalid or expired');
    }

    // Rotation: a refresh token works once. Reuse of an old one means it leaked, so end that whole session.
    const { count } = await prisma.oAuthRefreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    if (count !== 1) {
        await prisma.oAuthRefreshToken.updateMany({
            where: { adminId: stored.adminId, clientId: stored.clientId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        throw new OAuthTokenError('invalid_grant', 'Refresh token was already used');
    }

    const admin = await prisma.admin.findUnique({ where: { id: stored.adminId }, select: ADMIN_TOKEN_SELECT });
    if (!canUseAssistant(admin)) {
        throw new OAuthTokenError('invalid_grant', 'This account may not use the assistant');
    }

    return issueTokens({ adminId: admin.id, clientId: client.id, scope: stored.scope, resource });
}

/**
 * Checks an assistant access token for this server and reloads the admin, so turning off
 * "Asistan Kullanabilir" or deactivating the admin takes effect on the next request.
 * Returns { admin, payload } or null.
 */
export async function verifyAccessToken(token, resource) {
    let payload;
    try {
        payload = jwt.verify(token, accessTokenKey(), { audience: resource });
    } catch {
        return null;
    }

    const admin = await prisma.admin.findUnique({ where: { id: payload.sub }, select: ADMIN_TOKEN_SELECT });
    if (!canUseAssistant(admin)) return null;

    return {
        payload,
        admin: {
            id: admin.id,
            username: admin.username,
            name: admin.name,
            permissions: Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, admin[field]])),
        },
    };
}
