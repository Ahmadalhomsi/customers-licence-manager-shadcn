// lib/assistant-tools.js - MCP tools the AI assistant can call (see app/api/mcp/route.js)
// Every tool runs as the signed-in admin and checks that admin's current panel permissions.
import { fromJsonSchema } from '@modelcontextprotocol/server';
import prisma from '@/lib/prisma';
import { MONTH_PATTERN, getDashboard, isTrial, monthStart } from '@/lib/dashboard';
import { EXTEND_PERIODS, LicenceError, extendServices, istanbulDate, makeServicesUnlimited, remainingDays } from '@/lib/licences';
import { getProductLine } from '@/lib/licence-products';
import { normalizePhone } from '@/lib/phone';
import { findIdsByTurkishSearch } from '@/lib/turkish-search';
import { normalizeTurkish } from '@/lib/turkish-utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LICENCES_PER_CHANGE = 20;

export const SERVER_INSTRUCTIONS = `MAPOS licence manager. A "licence" is one service row: one product on one device (terminal) for one customer.
Products: Adisyon Programı (POS software), online food platform integrations (Yemek Sepeti, Trendyol, Getir, Migros), Yazarkasa POS, Patron app and others.
Dates are Europe/Istanbul calendar dates. remainingDays: 0 = ends today, negative = already expired, null = unlimited.
Before calling extend_licences, make_licences_unlimited or set_licence_status, show the user which licences will change (customer, product, device, current end date) and the result, and wait for a clear yes.
Answer in the user's language (usually Turkish).`;

class ToolError extends Error {}

function json(value) {
    return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function toolError(message) {
    return { isError: true, content: [{ type: 'text', text: message }] };
}

// The admin is resolved by the auth wrapper on every request (fresh permissions, see lib/oauth.js)
function currentAdmin(ctx) {
    const admin = ctx?.http?.authInfo?.extra?.admin;
    if (!admin) throw new ToolError('Not signed in.');
    return admin;
}

function requirePermission(admin, permission, label) {
    if (!admin.permissions[permission]) {
        throw new ToolError(`Your account does not have the "${label}" permission in the licence panel.`);
    }
}

// Wraps a tool handler: permission/validation errors become tool errors the assistant can explain
function handler(fn) {
    return async (args, ctx) => {
        try {
            return await fn(args, ctx);
        } catch (error) {
            if (error instanceof ToolError || error instanceof LicenceError) return toolError(error.message);
            console.error('Assistant tool error:', error);
            return toolError('Unexpected server error, nothing was changed.');
        }
    };
}

async function logAction(admin, tool, input, result) {
    await prisma.assistantActionLog.create({
        data: {
            adminId: admin.id,
            adminUsername: admin.username,
            tool,
            input: JSON.stringify(input),
            result: JSON.stringify(result),
        },
    });
}

const LICENCE_SELECT = {
    id: true,
    name: true,
    companyName: true,
    category: true,
    description: true,
    terminal: true,
    paymentType: true,
    periodPrice: true,
    currency: true,
    active: true,
    archived: true,
    startingDate: true,
    endingDate: true,
    lastLoginDate: true,
    version: true,
    customerID: true,
};

// Licence as shown to the assistant; customer contact details only with the customer view permission
function describeLicence(service, admin, customer) {
    return {
        licenceId: service.id,
        name: service.name,
        companyName: service.companyName,
        product: getProductLine(service.category).label,
        category: service.category,
        device: service.terminal,
        paymentType: service.paymentType,
        price: service.periodPrice != null ? `${service.periodPrice} ${service.currency}` : null,
        active: service.active,
        archived: service.archived,
        trial: isTrial({ ...service, customer }),
        startDate: istanbulDate(service.startingDate),
        endDate: service.paymentType === 'unlimited' ? null : istanbulDate(service.endingDate),
        remainingDays: remainingDays(service),
        lastLogin: service.lastLoginDate ? istanbulDate(service.lastLoginDate) : null,
        ...(customer ? { customer: describeCustomer(customer, admin) } : {}),
    };
}

function describeCustomer(customer, admin) {
    return {
        customerId: customer.id,
        name: customer.name,
        signBoard: customer.signBoard,
        ...(admin.permissions.canViewCustomers ? { phone: customer.phone, email: customer.email } : {}),
    };
}

const CUSTOMER_SELECT = { id: true, name: true, signBoard: true, phone: true, email: true };

const monthlyOverviewSchema = fromJsonSchema({
    type: 'object',
    properties: {
        month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: 'Month as YYYY-MM. Defaults to the current month.' },
    },
    additionalProperties: false,
});

const searchSchema = fromJsonSchema({
    type: 'object',
    properties: {
        query: { type: 'string', minLength: 2, description: 'Customer name, signboard, business/licence name, device name, or phone number in any format.' },
    },
    required: ['query'],
    additionalProperties: false,
});

const getLicenceSchema = fromJsonSchema({
    type: 'object',
    properties: { licence_id: { type: 'string', description: 'licenceId from search_customers or list_expiring_licences.' } },
    required: ['licence_id'],
    additionalProperties: false,
});

const expiringSchema = fromJsonSchema({
    type: 'object',
    properties: {
        month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: 'List licences ending in this month (YYYY-MM). Overrides within_days.' },
        within_days: { type: 'integer', minimum: 1, maximum: 366, description: 'Licences ending from today up to this many days ahead. Default 30.' },
        expired_since_days: { type: 'integer', minimum: 0, maximum: 365, description: 'Also include licences that expired in the last N days and were not renewed. Default 0.' },
        product: { type: 'string', description: 'Optional product filter, e.g. "Adisyon", "Yemek Sepeti", "Patron".' },
    },
    additionalProperties: false,
});

const extendSchema = fromJsonSchema({
    type: 'object',
    properties: {
        licence_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_LICENCES_PER_CHANGE },
        period: {
            type: 'string',
            enum: [...Object.keys(EXTEND_PERIODS), 'custom'],
            description: 'How much to add to the current end date, or "custom" to set ending_date.',
        },
        ending_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'New end date (YYYY-MM-DD, Istanbul) when period is "custom". Must be later than the current end date.' },
    },
    required: ['licence_ids', 'period'],
    additionalProperties: false,
});

const unlimitedSchema = fromJsonSchema({
    type: 'object',
    properties: {
        licence_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_LICENCES_PER_CHANGE },
    },
    required: ['licence_ids'],
    additionalProperties: false,
});

const statusSchema = fromJsonSchema({
    type: 'object',
    properties: {
        licence_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: MAX_LICENCES_PER_CHANGE },
        status: {
            type: 'string',
            enum: ['active', 'inactive', 'archived', 'unarchived'],
            description: 'inactive: the customer\'s program stops working on that device. archived: hidden from the main lists (program keeps working). active / unarchived undo these.',
        },
    },
    required: ['licence_ids', 'status'],
    additionalProperties: false,
});

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

export function registerAssistantTools(server) {
    server.registerTool('monthly_overview', {
        title: 'Monthly licence overview',
        description: 'Licence renewal figures for a month, the same numbers as the dashboard: licences due (expected), already renewed, still pending, renewals done, new licences and devices, split by product, plus a 12-month trend. Adisyon and online food platforms count one licence per customer; other products one per device.',
        inputSchema: monthlyOverviewSchema,
        annotations: READ_ONLY,
    }, handler(async ({ month }, ctx) => {
        const admin = currentAdmin(ctx);
        requirePermission(admin, 'canViewServices', 'Hizmetleri Görüntüleme');

        const data = await getDashboard(month);
        const { products, ...summary } = data.summary;
        return json({
            month: data.month,
            currentMonth: data.currentMonth,
            summary,
            byProduct: products,
            trend: data.trend.map(({ products: _, ...row }) => row),
        });
    }));

    server.registerTool('search_customers', {
        title: 'Find customers and their licences',
        description: 'Searches customers by name, signboard, phone number (any format), licence/business name or device name, and returns up to 10 customers with all their licences, end dates and remaining days.',
        inputSchema: searchSchema,
        annotations: READ_ONLY,
    }, handler(async ({ query }, ctx) => {
        const admin = currentAdmin(ctx);
        requirePermission(admin, 'canViewServices', 'Hizmetleri Görüntüleme');

        const customerIds = new Set();
        const phone = normalizePhone(query);
        if (phone && phone.length >= 7) {
            // Phones are free text in the database, so compare normalized numbers
            const customers = await prisma.customer.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } });
            customers.filter((customer) => normalizePhone(customer.phone)?.endsWith(phone)).forEach((customer) => customerIds.add(customer.id));
        } else {
            (await findIdsByTurkishSearch('Customer', ['name', 'signBoard'], query)).forEach((id) => customerIds.add(id));
            const serviceIds = await findIdsByTurkishSearch('Service', ['name', 'companyName', 'terminal'], query);
            if (serviceIds.length > 0) {
                const services = await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { customerID: true } });
                services.forEach((service) => customerIds.add(service.customerID));
            }
        }

        const ids = [...customerIds];
        const customers = await prisma.customer.findMany({
            where: { id: { in: ids.slice(0, 10) } },
            select: { ...CUSTOMER_SELECT, services: { select: LICENCE_SELECT, orderBy: { endingDate: 'asc' } } },
        });

        return json({
            matches: ids.length,
            shown: customers.length,
            customers: customers.map(({ services, ...customer }) => ({
                ...describeCustomer(customer, admin),
                licences: services.map((service) => describeLicence(service, admin, null)),
            })),
        });
    }));

    server.registerTool('get_licence', {
        title: 'Licence details',
        description: 'One licence with its customer, end date, remaining days and the last 10 renewals.',
        inputSchema: getLicenceSchema,
        annotations: READ_ONLY,
    }, handler(async ({ licence_id }, ctx) => {
        const admin = currentAdmin(ctx);
        requirePermission(admin, 'canViewServices', 'Hizmetleri Görüntüleme');

        const service = await prisma.service.findUnique({
            where: { id: licence_id },
            select: {
                ...LICENCE_SELECT,
                customer: { select: CUSTOMER_SELECT },
                RenewalHistory: { orderBy: { createdAt: 'desc' }, take: 10, select: { type: true, previousEndDate: true, newEndDate: true, createdAt: true } },
            },
        });
        if (!service) throw new ToolError('Licence not found.');

        return json({
            ...describeLicence(service, admin, service.customer),
            renewals: service.RenewalHistory.map((renewal) => ({
                renewedOn: istanbulDate(renewal.createdAt),
                type: renewal.type,
                from: istanbulDate(renewal.previousEndDate),
                to: istanbulDate(renewal.newEndDate),
            })),
        });
    }));

    server.registerTool('list_expiring_licences', {
        title: 'Licences ending soon',
        description: 'Licences ending in a month or within the next N days (optionally also recently expired, unrenewed ones), soonest first, with customer and remaining days. Leaves out trials, unlimited and archived licences. Returns at most 100.',
        inputSchema: expiringSchema,
        annotations: READ_ONLY,
    }, handler(async ({ month, within_days = 30, expired_since_days = 0, product }, ctx) => {
        const admin = currentAdmin(ctx);
        requirePermission(admin, 'canViewServices', 'Hizmetleri Görüntüleme');

        let range;
        if (month && MONTH_PATTERN.test(month)) {
            const [year, monthNumber] = month.split('-').map(Number);
            range = { gte: monthStart(year, monthNumber - 1), lt: monthStart(year, monthNumber) };
        } else {
            const now = Date.now();
            range = { gte: new Date(now - expired_since_days * DAY_MS), lt: new Date(now + within_days * DAY_MS) };
        }

        const services = await prisma.service.findMany({
            where: { archived: false, paymentType: { not: 'unlimited' }, endingDate: range },
            select: { ...LICENCE_SELECT, customer: { select: CUSTOMER_SELECT } },
            orderBy: { endingDate: 'asc' },
        });

        const productFilter = product ? normalizeTurkish(product) : null;
        const matching = services.filter((service) => !isTrial(service) && (!productFilter
            || normalizeTurkish(getProductLine(service.category).label).includes(productFilter)
            || normalizeTurkish(service.category).includes(productFilter)));

        return json({
            period: month && MONTH_PATTERN.test(month) ? month : { from: istanbulDate(range.gte), to: istanbulDate(range.lt) },
            total: matching.length,
            licences: matching.slice(0, 100).map((service) => describeLicence(service, admin, service.customer)),
        });
    }));

    server.registerTool('extend_licences', {
        title: 'Extend licences',
        description: `Extends up to ${MAX_LICENCES_PER_CHANGE} licences by a period (added to each current end date) or to a custom end date, and records the renewal like the panel's bulk extend. Unlimited licences are skipped; a custom date never shortens a licence. Confirm with the user first.`,
        inputSchema: extendSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, handler(async ({ licence_ids, period, ending_date }, ctx) => {
        const admin = currentAdmin(ctx);
        requirePermission(admin, 'canEditServices', 'Hizmetleri Düzenleme');
        if (period === 'custom' && !ending_date) throw new ToolError('ending_date is required when period is "custom".');

        const result = await extendServices({
            serviceIds: licence_ids,
            period,
            // A date picked in the panel is midnight in Istanbul
            endingDate: ending_date ? `${ending_date}T00:00:00+03:00` : undefined,
        });

        const summary = {
            extended: result.extended.map((service) => ({
                licenceId: service.id,
                name: service.name,
                previousEndDate: istanbulDate(service.previousEndDate),
                newEndDate: istanbulDate(service.newEndDate),
                remainingDays: remainingDays({ endingDate: service.newEndDate }),
            })),
            skippedUnlimited: result.skippedUnlimited,
            skippedAlreadyLater: result.skippedNotLater,
            notFound: result.notFound,
        };
        await logAction(admin, 'extend_licences', { licence_ids, period, ending_date }, summary);
        return json(summary);
    }));

    server.registerTool('make_licences_unlimited', {
        title: 'Make licences unlimited',
        description: `Makes up to ${MAX_LICENCES_PER_CHANGE} licences "Sınırsız" (unlimited, never expire), exactly like choosing payment type "Sınırsız" in the panel. Use this when the user asks for an unlimited licence instead of extending by a long period. Licences that are already unlimited are skipped. Confirm with the user first.`,
        inputSchema: unlimitedSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, handler(async ({ licence_ids }, ctx) => {
        const admin = currentAdmin(ctx);
        requirePermission(admin, 'canEditServices', 'Hizmetleri Düzenleme');

        const result = await makeServicesUnlimited(licence_ids);
        const summary = {
            madeUnlimited: result.changed.map((service) => ({
                licenceId: service.id,
                name: service.name,
                previousPaymentType: service.previousPaymentType,
                previousEndDate: istanbulDate(service.previousEndDate),
            })),
            alreadyUnlimited: result.alreadyUnlimited,
            notFound: result.notFound,
        };
        await logAction(admin, 'make_licences_unlimited', { licence_ids }, summary);
        return json(summary);
    }));

    server.registerTool('set_licence_status', {
        title: 'Activate, deactivate or archive licences',
        description: `Changes the status of up to ${MAX_LICENCES_PER_CHANGE} licences. "inactive" makes the customer's program stop working on that device; "archived" only hides the licence from the panel's main lists. Confirm with the user first, especially for "inactive".`,
        inputSchema: statusSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    }, handler(async ({ licence_ids, status }, ctx) => {
        const admin = currentAdmin(ctx);
        requirePermission(admin, 'canEditServices', 'Hizmetleri Düzenleme');

        const ids = [...new Set(licence_ids)];
        const data = {
            active: { active: true },
            inactive: { active: false },
            archived: { archived: true, archivedAt: new Date() },
            unarchived: { archived: false, archivedAt: null },
        }[status];
        if (!data) throw new ToolError('Unknown status.');

        const { count } = await prisma.service.updateMany({ where: { id: { in: ids } }, data });
        const services = await prisma.service.findMany({
            where: { id: { in: ids } },
            select: { ...LICENCE_SELECT, customer: { select: CUSTOMER_SELECT } },
        });

        const summary = {
            status,
            updated: count,
            notFound: ids.length - services.length,
            licences: services.map((service) => describeLicence(service, admin, service.customer)),
        };
        await logAction(admin, 'set_licence_status', { licence_ids: ids, status }, { status, updated: count, licenceIds: services.map((s) => s.id) });
        return json(summary);
    }));
}
