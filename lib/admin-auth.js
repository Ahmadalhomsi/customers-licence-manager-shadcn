// lib/admin-auth.js - Username/password check with per-IP lockout, shared by the web login and the assistant (OAuth) login
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

export function getClientIp(req) {
    return req.headers.get('x-forwarded-for') || req.ip || 'unknown';
}

/**
 * Returns { status: 'blocked' } while the IP is locked out, { status: 'invalid' } for a wrong
 * username/password or an inactive admin (each counts as a failed attempt), or { status: 'ok', admin }.
 */
export async function checkAdminCredentials(req, username, password) {
    const ipAddress = getClientIp(req);

    const failedAttempt = await prisma.failedLoginAttempt.findUnique({ where: { ipAddress } });
    if (failedAttempt?.blockedUntil && new Date() < failedAttempt.blockedUntil) {
        return { status: 'blocked' };
    }

    const admin = username ? await prisma.admin.findUnique({ where: { username } }) : null;
    const passwordMatch = Boolean(admin?.active && password) && await bcrypt.compare(password, admin.password);

    if (passwordMatch) {
        if (failedAttempt) {
            await prisma.failedLoginAttempt.delete({ where: { ipAddress } });
        }
        return { status: 'ok', admin };
    }

    const attempts = (failedAttempt?.attempts || 0) + 1;
    const blockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + BLOCK_DURATION) : null;
    await prisma.failedLoginAttempt.upsert({
        where: { ipAddress },
        update: { attempts, blockedUntil },
        create: { ipAddress, attempts, blockedUntil },
    });

    return { status: 'invalid' };
}
