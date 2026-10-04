// lib/turkish-search.js - Server-side Turkish-insensitive search (PostgreSQL)
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { normalizeTurkish, TURKISH_FROM, TURKISH_TO } from '@/lib/turkish-utils';

// Combining marks (grave, acute, circumflex, breve, dot above, diaeresis, cedilla).
// They have no counterpart in TO, so translate() deletes them. This handles
// decomposed text such as "o" + U+0308 as well as "i" + U+0307 left by bad lowercasing.
const COMBINING_MARKS = '̧̀́̂̆̇̈';
const SQL_FROM = TURKISH_FROM + COMBINING_MARKS;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Builds `lower(translate("col", FROM, TO))`, the SQL equivalent of normalizeTurkish().
 * Characters are mapped to ASCII before lower() so the result does not depend on the
 * database locale/collation (Postgres ILIKE gets İ/I/ı/i wrong under non-Turkish locales).
 */
function normalizedColumn(column) {
    if (!IDENTIFIER.test(column)) {
        throw new Error(`Invalid column name: ${column}`);
    }
    return Prisma.sql`lower(translate(${Prisma.raw(`"${column}"`)}, ${SQL_FROM}, ${TURKISH_TO}))`;
}

/**
 * Returns the ids of rows in `table` where any of `columns` contains `term`,
 * ignoring case and Turkish characters (e.g. "kosk" matches "KÖŞK", "istanbul" matches "İSTANBUL").
 *
 * `table` and `columns` must be hard-coded identifiers, never user input.
 */
export async function findIdsByTurkishSearch(table, columns, term) {
    const needle = normalizeTurkish(term).trim();
    if (!needle || !columns?.length) return [];

    if (!IDENTIFIER.test(table)) {
        throw new Error(`Invalid table name: ${table}`);
    }

    const conditions = columns.map(
        (column) => Prisma.sql`strpos(${normalizedColumn(column)}, ${needle}) > 0`
    );

    const rows = await prisma.$queryRaw`
        SELECT "id" FROM ${Prisma.raw(`"${table}"`)}
        WHERE ${Prisma.join(conditions, ' OR ')}
    `;

    return rows.map((row) => row.id);
}
