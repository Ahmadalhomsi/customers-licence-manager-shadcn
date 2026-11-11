// lib/licence-extend.js - Extend date math shared by the bulk extend modal (client) and lib/licences.js (server).
// No server imports here: the modal imports this file.
// Europe/Istanbul is fixed UTC+3 (same as ISTANBUL_OFFSET_MS in lib/dashboard.js, which is server-only)
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Adds months on the Istanbul calendar, whatever the machine's time zone. A panel date is stored as
 * midnight Istanbul (31 Jan -> 30 Jan 21:00 UTC), so plain addMonths on a UTC server would count from the 30th.
 * A day that does not exist in the target month becomes its last day (31 Jan + 1 month = 28/29 Feb).
 */
export function addMonthsIstanbul(date, months) {
    const local = new Date(new Date(date).getTime() + ISTANBUL_OFFSET_MS);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(local.getUTCDate(), lastDay);
    const timeOfDay = local.getTime() % (24 * 60 * 60 * 1000);
    return new Date(Date.UTC(year, month, day) + timeOfDay - ISTANBUL_OFFSET_MS);
}

// Whole months between two dates on the Istanbul calendar (ignores the day of month)
function monthIndex(date) {
    const local = new Date(new Date(date).getTime() + ISTANBUL_OFFSET_MS);
    return local.getUTCFullYear() * 12 + local.getUTCMonth();
}

// Renewal type -> number of months to add (same types used by RenewHistory)
export const EXTEND_PERIODS = {
    '1month': 1,
    '6months': 6,
    '1year': 12,
    '2years': 24,
    '3years': 36,
};

// What a period is counted from:
// 'end'   - added to the current end date (10/11/2027 + 1 year = 10/11/2028)
// 'start' - whole periods counted from the start date; the end moves to the next start anniversary
//           after the current end (start 03/10/2025, end 10/11/2027 + 1 year = 03/10/2028)
export const EXTEND_BASES = ['end', 'start'];

/**
 * New end date for one service, or null when it cannot be worked out (missing date).
 * period is a key of EXTEND_PERIODS, or 'custom' (then customEndDate is returned as is).
 */
export function newEndDateFor(service, { period, base = 'end', customEndDate }) {
    if (period === 'custom') return customEndDate ?? null;

    const months = EXTEND_PERIODS[period];
    const end = new Date(service.endingDate);
    if (!months || Number.isNaN(end.getTime())) return null;
    if (base !== 'start') return addMonthsIstanbul(end, months);

    const start = new Date(service.startingDate);
    if (Number.isNaN(start.getTime())) return null;

    // Smallest n with start + n periods after the current end. Always counted from the start date
    // (not step by step) so a start on the 31st does not drift to the 28th.
    let steps = Math.max(1, Math.floor((monthIndex(end) - monthIndex(start)) / months) - 1);
    while (addMonthsIstanbul(start, steps * months) <= end) steps += 1;
    return addMonthsIstanbul(start, steps * months);
}
