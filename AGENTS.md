# AGENTS.md

Full-stack invoicing app. Two independent npm packages — **no workspaces, no root scripts** (root `package.json` only holds Playwright for `test-app.mjs`).

## Layout

- `backend/` — Express + TypeScript REST API (PostgreSQL via `pg`, JWT auth). Port 4000.
- `frontend/` — React 19 + Vite + Tailwind v4 SPA. Port 5173, proxies `/api` → `:4000` (see `frontend/vite.config.ts`).
- `test-app.mjs` — end-to-end UI smoke test (Playwright, non-headless).

## Commands (run from each package dir)

| Where | Command | Notes |
|---|---|---|
| backend | `npm run dev` | tsx watch |
| backend | `npm run build` | `tsc` only — this is the backend typecheck; no lint/tests exist |
| frontend | `npm run dev` | Vite |
| frontend | `npm run build` | `tsc -b && vite build` — use `npx tsc -b` to typecheck alone |
| frontend | `npm run lint` | ESLint; only linter in the repo |
| frontend | `node scripts/ui-verify.mjs [--screens] [--axe]` | Playwright UI checks; both dev servers must be running |
| root | `node test-app.mjs` | Requires **both dev servers already running** and one-time `npx playwright install chromium`. Prints pass/fail summary; exits 0 regardless. |

## Database (biggest gotcha)

- `backend/schema.sql` is **stale**: `npm run db:setup` applies it, but it lacks columns the API queries: `User.baseCurrency`, `Product.basePrice`, `InvoiceItem.basePrice`, `Invoice.baseSubtotal/baseDiscountValue/baseTaxAmount/baseTotal`. On a fresh DB, run `npm run db:migrate-base-values` right after `db:setup`, or the API breaks.
- No migration framework (no Prisma, no tracking table). Remaining `db:migrate-*` scripts are ad-hoc, idempotent (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`) and safe to re-run in any order: `db:migrate-defaults`, `db:migrate-currency`, `db:migrate-payment`, `db:migrate-currency-rate`, `db:migrate-token-version`, `db:migrate-payment-base-values`.
- `npm run db:seed` is **destructive** — deletes all invoices/clients/products for every existing user, then reseeds. Demo login created if DB empty: `demo@billflow.com` / `Demo1234!`.
- `backend/scripts/*.mjs` load `backend/.env` themselves; `src/config/env.ts` uses dotenv from cwd — always run from `backend/`.
- `.env.example` is incomplete. Code also reads `APP_URL` (defaults `http://localhost:5173`) and `SMTP_*`; with `SMTP_HOST` unset, email sends are mocked (logged, `mocked: true` in response).

## Architecture notes

- `backend/src/db/prisma.ts` is a dead stub — the DB layer is `db/pool.ts` (`pg` Pool). `db:setup` is a Node script using `pg`, not `psql`.
- Every resource is scoped by `userId` from the `auth` middleware (`req.user.id`).
- Multi-currency: user has `currency` + `baseCurrency`; products/invoices store display values and full-precision `base*` values side by side. Switching currency rewrites stored prices (`routes/me.ts`). Do not drop or bypass the `base*` columns.
- `src/jobs/overdue.ts` flips PENDING → OVERDUE on server start and daily at 03:00.
- PDF has two implementations: backend PDFKit (`GET /api/invoices/:id/pdf`, header auth only) and client-side `jspdf`/`exceljs` exports on the Reports page.
- Frontend: axios instance in `src/lib/api.ts` (baseURL `/api`, Bearer token in `localStorage`, 401 → redirect to `/login` unless on an auth page), React Query, `@/` alias → `src/`, Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config`).
- i18n: 6 locales (`frontend/src/i18n/locales/*.ts`). Add new UI strings to **all** locale files — missing translations are a recurring bug pattern here. Exception: `ReportsPage.tsx` is fully hardcoded English (no `useTranslation`), including its export/print content.
- Frontend route `/pay/:token` renders a public invoice; backend public endpoints live in `routes/publicInvoices.ts`.
- Nav config lives in `frontend/src/components/layout/nav.ts`; nav/actions carry `data-testid` attributes used by `test-app.mjs` and `scripts/ui-verify.mjs`. Keep them when refactoring.

## Known quirks / traps

- `POST /api/auth/forgot` emails a reset link (mocked to the backend log when `SMTP_HOST` is unset) — grep the log for `Reset your BillFlow password` during local dev.
- Invoice money math exists twice on purpose: `backend/src/utils/invoiceMath.ts` and `frontend/src/lib/invoiceMath.ts` must stay in sync (backend PDF uses the backend copy; `ReportsPage` exports have their own formatting).
- Date-only inputs are sent as noon UTC via `dateOnlyToIso`/`todayLocal` (`frontend/src/lib/utils.ts`) so the calendar day never shifts by timezone; keep that convention for new date pickers.
- CORS is allowlisted to `CORS_ORIGINS` (comma-separated) or `APP_URL` (`backend/src/app.ts`); set `CORS_ORIGINS` if the frontend runs on another origin.
- Reports print/export templates build raw HTML — keep escaping interpolated names via `escapeHtml` (`ReportsPage.tsx`).

## Stale docs

`CLAUDE.md` and `backend/README.md` predate the frontend and current scripts (e.g. `npm run migrate` does not exist; `db:setup` does not use psql; API table omits payments/bulk/currency routes). Trust `package.json` and `schema.sql` + `scripts/` over these.
