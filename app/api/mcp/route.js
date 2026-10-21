import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { SERVER_INSTRUCTIONS, registerAssistantTools } from '@/lib/assistant-tools';
import { MCP_SCOPE, mcpResourceUrl, verifyAccessToken } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

/**
 * MCP server for AI assistants (ChatGPT, Claude). Connect with the URL <APP_URL>/api/mcp; the assistant is sent
 * through /oauth/authorize where an admin with the "Asistan Kullanabilir" permission signs in.
 */
const handler = createMcpHandler(registerAssistantTools, {
    serverInfo: { name: 'mapos-licence-manager', version: '1.0.0' },
    instructions: SERVER_INSTRUCTIONS,
});

async function verifyToken(req, bearerToken) {
    if (!bearerToken) return undefined;

    const verified = await verifyAccessToken(bearerToken, mcpResourceUrl(req));
    if (!verified) return undefined;

    return {
        token: bearerToken,
        clientId: verified.payload.client_id,
        scopes: verified.payload.scope.split(' '),
        expiresAt: verified.payload.exp,
        extra: { admin: verified.admin },
    };
}

const authHandler = withMcpAuth(handler, verifyToken, {
    required: true,
    requiredScopes: [MCP_SCOPE],
    // Without APP_URL the public origin comes from the reverse proxy's X-Forwarded-* headers
    resourceUrl: process.env.APP_URL?.replace(/\/$/, ''),
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
