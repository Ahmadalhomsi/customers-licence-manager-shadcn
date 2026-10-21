# AGENTS.md

Guidance for coding agents (and humans) working on this repository.

## What this is

**MAPOS Customer Services Manager** — the internal panel MAPOS uses to sell and manage software licences
(mainly the "Adisyon Programı" restaurant POS). Staff manage customers, licences ("services"), renewals,
physical products and admin users. The POS apps call public endpoints to validate their licence, and managers
can use an AI assistant (ChatGPT / Claude) through an MCP server.

The UI and user-facing messages are **Turkish**. Code, comments and identifiers are English.

## Stack and commands

- Next.js 16 (App Router, Turbopack, `proxy.js` instead of `middleware.js`), React 19, mostly **JavaScript** (`allowJs`; a few `.ts` routes).
- Prisma 6 + PostgreSQL. Tailwind 3 + shadcn/ui (`components/ui`, new-york style, lucide icons). Toasts: `sonner`.
- Package manager: **pnpm**. `package-lock.json` is stale; do not use npm to install.

```bash
pnpm install
pnpm dev            # next dev --turbopack
pnpm build
pnpm lint           # next lint (eslint next/core-web-vitals)
npx prisma generate
```

There is **no test suite**. Verify changes by running the affected flow, or by calling route handlers directly with a stubbed Prisma client.

## Layout

| Path | What |
|---|---|
| `app/page.js` | Dashboard (home): monthly renewals, new licences, product breakdown, charts |
| `app/customers`, `app/services`, `app/products`, `app/log`, `app/admins` | Panel pages |
| `app/api/*` | Panel API (cookie JWT auth) |
| `app/api/external/*` | Public endpoints used by the POS apps (licence validation, trial creation, renew) |
| `app/api/mcp` | MCP server for the AI assistant |
| `app/api/oauth/*`, `app/oauth/authorize`, `app/.well-known/*` | OAuth 2.1 server the assistant signs in through |
| `app/api/cron/check-services` | Daily expiry notifications (called by an external scheduler) |
| `components/<page>Page/` | Page-specific components (`dashboardPage`, `servicesPage`, `mainPage` = customers, `logPage`, …) |
| `lib/` | Shared server/client logic (see below) |
| `prisma/schema.prisma`, `prisma/migrations/` | Schema and SQL migrations |
| `proxy.js` | Login gate for every page and API route |

Key `lib/` modules:

- `jwt.js` — `verifyJWT(token)`: verifies the web login token **and reloads the admin from the DB** (current permissions; inactive admins rejected). `PERMISSION_FIELDS` lists every permission flag.
- `admin-auth.js` — username/password check with per-IP lockout (5 failures → 15 min), shared by web login and assistant login.
- `admin.js` — `ADMIN_SELECT` (admin fields without the password hash), `pickPermissions`.
- `dashboard.js` — monthly figures (`getDashboard`), Istanbul month helpers, `isTrial`, `customerKey`.
- `licences.js` — `extendServices`, `makeServicesUnlimited`, `remainingDays`, `istanbulDate`, `UNLIMITED_END_DATE`.
- `licence-products.js` — product lines and which ones count one licence per customer.
- `phone.js` — `normalizePhone` (Turkish numbers to 10 digits; placeholders → null).
- `turkish-search.js` / `turkish-utils.js` — Turkish-insensitive search (`ı/i`, `ş/s`, …).
- `oauth.js`, `assistant-tools.js` — assistant sign-in and MCP tools.
- `auth.js`, `api-utils.js`, `simple-auth.js` — client-side fetch helpers (redirect to login on 401).

## Auth and permissions

- Web login (`/api/login`) issues a 30-day JWT stored in the `token` cookie (and localStorage).
- `proxy.js` requires that cookie for every page and API route except the `publicRoutes` list
  (`/login`, `/api/login`, `/api/external`, `/api/cron`, `/api/mcp`, `/api/oauth`, `/oauth`, `/.well-known`).
  Routes on that list must authenticate themselves.
- **Every API route checks a permission itself**, even though the proxy already checked the login:

  ```js
  const decoded = await verifyJWT(req.cookies.get('token')?.value);
  if (!decoded.permissions.canEditServices) {
      return NextResponse.json({ error: 'Yasak: Hizmet güncelleme izniniz yok' }, { status: 403 });
  }
  ```

  Permissions: `canView/EditCustomers`, `canView/EditServices`, `canView/EditAdmins`, `canSeePasswords`,
  `canView/EditPhysicalProducts`, `canUseAssistant`. Use the permissions from `verifyJWT`, never the ones baked into the token.
- Never return password columns: `Admin.password` (bcrypt hash) and `Customer.password` (shown only with `canSeePasswords`).
  Prefer explicit Prisma `select`s. Customer phone/email go to the assistant only with `canViewCustomers`.
- `/api/cron/check-services` requires `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set.

## Domain rules

- **Service = one licence for one product on one device** (`terminal` is the device name; `deviceToken`/`deviceTokenV2` identify it).
- **Product lines** (`lib/licence-products.js`): Adisyon Programı and the online food platforms (Yemek Sepeti, Trendyol,
  Getir, Migros) count **one licence per customer**; every other product counts one licence per device. Several category
  strings map to one product because the service forms save different names for the same product.
- **Customers are matched by phone number** (`normalizePhone`), falling back to the customer id. Phones are free text in the DB.
- **Trials** are created automatically by `/api/external/validation(v2)` and `/api/external/customer`: customer
  `Trial Customer`, or `paymentType: 'custom'` + description starting with `Trial service`. Converting a trial changes
  `paymentType` but keeps the description. Use `isTrial()` from `lib/dashboard.js`.
- **Unlimited** licences: `paymentType: 'unlimited'` **and** `endingDate = 9999-12-31T00:00:00Z` (`UNLIMITED_END_DATE`).
  They never expire and are skipped by extends, reminders and expiry counts.
- **Renewals**: moving an end date forward writes a `RenewHistory` row (`services/[id]` PUT, bulk extend, external renew,
  assistant). Switching to or from unlimited does not. The dashboard counts renewals from `RenewHistory`.
- `active: false` makes the customer's program fail validation (`SERVICE_INACTIVE`). `archived` only hides the licence in the panel.
- **Time zone is Europe/Istanbul (fixed UTC+3).** A date picked in the panel is stored as midnight Istanbul
  (e.g. 27 Feb → `…-02-26T21:00:00Z`). Use the helpers in `lib/dashboard.js` / `lib/licences.js` for month keys and remaining days.

## Database changes

1. Edit `prisma/schema.prisma`.
2. Generate the migration SQL with Prisma (no database needed), comparing against the committed schema:

   ```bash
   git show HEAD:prisma/schema.prisma > /tmp/old.prisma
   npx prisma migrate diff --from-schema-datamodel /tmp/old.prisma --to-schema-datamodel prisma/schema.prisma --script \
     > prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql
   ```

3. Migrations run automatically on container start (`prisma migrate deploy` in the Dockerfile `CMD`).

The editor may flag `url` in the `datasource` block — that warning is from Prisma 7 tooling; this project is on Prisma 6.

## Dependencies and deployment

- Deployed with Docker on Coolify. The Dockerfile installs with **pnpm 9** and `--frozen-lockfile`, so `pnpm-lock.yaml`
  must match `package.json`. Update the lockfile with the same major version to avoid unrelated upgrades:

  ```bash
  npx pnpm@9 install --lockfile-only
  ```

- Environment (see `.env.example`): `DATABASE_URL`, `JWT_SECRET` (required — login refuses to work without it),
  `CRON_SECRET`, `APP_URL` (public URL; used by OAuth metadata and assistant token audience), `renewPassword`
  (only for `/api/external/renew`), optional `MCP_REDIRECT_HOSTS`.

## AI assistant (MCP)

- Endpoint: `<APP_URL>/api/mcp` (`mcp-handler` 2.x + `@modelcontextprotocol/server` 2.x, stateless Streamable HTTP).
- Sign-in: OAuth 2.1 with dynamic client registration and PKCE. Admins sign in on `/oauth/authorize` and need the
  `canUseAssistant` permission ("Asistan Kullanabilir" on the Users page). Redirect URIs are limited to known assistant
  hosts (`isAllowedRedirectUri`).
- Assistant access tokens use a key derived from `JWT_SECRET`, so web tokens and assistant tokens are not interchangeable.
  Refresh tokens rotate; reusing an old one revokes the session.
- Tools live in `lib/assistant-tools.js`. When adding one:
  - Input schemas are plain JSON Schema via `fromJsonSchema` (the app uses zod 3; the MCP SDK expects Standard Schema with JSON Schema output).
  - Check the admin's panel permission (`requirePermission`) and set `annotations` (`readOnlyHint: true` for reads).
  - Put shared business logic in `lib/` so the panel API and the tool behave the same.
  - Record every change with `logAction` (table `AssistantActionLog`).
  - **Assistants cache the tool list**: after deploying a new or renamed tool, users must disconnect and reconnect the connector.

## Conventions and pitfalls

- Match the surrounding file: indentation differs between files (4 spaces in API routes and `lib/`, 2 or 4 in components); Turkish UI copy.
- Route files (`route.js`) may only export HTTP handlers and route config (`dynamic`, …). Put helpers in `lib/`.
  Route config such as `export const dynamic` must be declared in the file, not re-exported.
- Show API errors to the user with the server's message: read `data.error || data.message` from a failed `fetch`
  (there is no `error.response` on fetch errors). Use `toast.success` / `toast.error` from `sonner`.
- Admin forms: give password inputs `autoComplete="new-password"` so the browser does not autofill the signed-in admin's password.
- Dashboard charts are hand-drawn SVG (`components/dashboardPage/charts.jsx`) with colors from `--viz-1..3` in `app/globals.css`
  (colorblind-checked). Keep one meaning per color: blue = renewed, orange = pending, green = new.
- The root `*-SUMMARY.md`, `output.txt`, `coolifyOutput.txt` and `backup.sql` files are historical artifacts, not documentation of current behavior.
