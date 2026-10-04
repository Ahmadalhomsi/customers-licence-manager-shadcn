/**
 * Turkish character normalization utilities (safe to import on client and server)
 */

// Turkish / circumflex letters and their ASCII equivalents.
// Kept in sync with TURKISH_FROM / TURKISH_TO used in SQL (lib/turkish-search.js).
export const TURKISH_FROM = 'ÇĞİIÖŞÜÂÎÛçğıöşüâîû';
export const TURKISH_TO = 'CGIIOSUAIUcgiosuaiu';

const TURKISH_MAP = Object.fromEntries(
  [...TURKISH_FROM].map((ch, i) => [ch, TURKISH_TO[i]])
);
const TURKISH_REGEX = new RegExp(`[${TURKISH_FROM}]`, 'g');

/**
 * Normalize text for search: maps Turkish letters to ASCII, strips combining
 * marks and lowercases. "İSTANBUL", "Istanbul", "ıstanbul" and "istanbul" all
 * become "istanbul"; "Köşk" and "KOSK" both become "kosk".
 *
 * Mapping happens BEFORE lowercasing, because "İ".toLowerCase() yields
 * "i" + U+0307 (combining dot) in JavaScript.
 */
export function normalizeTurkish(text) {
  if (!text) return '';

  return String(text)
    .replace(TURKISH_REGEX, (ch) => TURKISH_MAP[ch])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Client-side helper: does `text` contain `query`, ignoring case and Turkish characters?
 */
export function turkishIncludes(text, query) {
  if (!query) return true;
  return normalizeTurkish(text).includes(normalizeTurkish(query));
}
