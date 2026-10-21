import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

export const PERMISSION_FIELDS = [
    'canViewCustomers', 'canEditCustomers', 'canViewServices', 'canEditServices',
    'canViewAdmins', 'canEditAdmins', 'canSeePasswords', 'canViewPhysicalProducts', 'canEditPhysicalProducts',
    'canUseAssistant',
];

/**
 * Verifies the token, then reloads the admin so a deactivated admin is locked out immediately
 * and permission changes apply without waiting for the (30-day) token to expire.
 * Returns the token payload with `permissions` replaced by the admin's current permissions.
 */
export async function verifyJWT(token) {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token expired');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        } else {
            throw new Error('Token verification failed');
        }
    }

    const admin = await prisma.admin.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true, name: true, active: true, ...Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, true])) },
    });

    if (!admin || !admin.active) {
        throw new Error('Invalid token');
    }

    return {
        ...decoded,
        username: admin.username,
        name: admin.name,
        permissions: Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, admin[field]])),
    };
}
