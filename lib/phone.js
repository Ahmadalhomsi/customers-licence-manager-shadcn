// lib/phone.js - Phone number normalization used to match customers by phone

/**
 * Normalizes a Turkish phone number to its 10-digit national form (e.g. "5321234567"),
 * so "0532 123 45 67", "+90 532 123 4567" and "5321234567" all match.
 * Returns null for empty values and for placeholders such as "000-000-0000".
 */
export function normalizePhone(phone) {
    if (!phone) return null;

    let digits = String(phone).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('90')) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

    if (!digits || /^0+$/.test(digits)) return null;
    return digits;
}
