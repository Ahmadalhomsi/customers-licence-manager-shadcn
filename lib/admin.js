// lib/admin.js - Shared admin field helpers for the admin API routes
import { PERMISSION_FIELDS } from '@/lib/jwt';

// Every admin field except the password hash
export const ADMIN_SELECT = {
    id: true,
    username: true,
    name: true,
    active: true,
    createdAt: true,
    updatedAt: true,
    ...Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, true])),
};

// Only known permission flags may be written, never arbitrary columns
export function pickPermissions(permissions = {}) {
    return Object.fromEntries(
        PERMISSION_FIELDS.filter((field) => field in permissions).map((field) => [field, Boolean(permissions[field])])
    );
}
