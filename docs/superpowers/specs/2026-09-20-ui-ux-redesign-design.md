# BillFlow UI/UX Redesign: Design Spec

Date: 2026-09-20
Status: approved in brainstorming, pending final user review
Scope: frontend only (`frontend/`), no API or database changes

## Goal

Redesign every screen of BillFlow around a bolder, more distinctive visual system, adopt a modern component stack (shadcn/ui, 21st.dev registry components), and fix weak interaction patterns. The app should feel like a modern fintech product in the Mercury family, using the palette the user supplied.

## Constraints

- Frontend only. No backend, API, or schema changes.
- `test-app.mjs` keeps its 33-check coverage; selectors and labels update as the UI changes.
- Every page works on mobile and meets WCAG AA (4.5:1 text, 3:1 UI) with keyboard navigation.
- New UI strings go into all six locale files (`frontend/src/i18n/locales/*.ts`). ReportsPage stays hardcoded English, as today.
- Dark mode and `ThemeContext` stay.

## Design decisions from brainstorming

| Decision | Choice |
|---|---|
| Approach | Design-system-first, migrate in place (3 phases) |
| Personality | Bold and distinctive |
| References | Mercury, 21st.dev trending |
| Palette | User-supplied teal / gray / lime set |
| Shell | Icon rail + flyout, hybrid interaction |
| Library stack | Curated modern stack |
| Dashboard | Bento grid |
| Invoices list | Ledger rows |
| New invoice | Form + sticky summary |
| Invoice detail | Document + action rail |
| Reports | Analytics workspace |
| Public invoice | Branded hero |
| Responsive/a11y | Mobile + WCAG AA |

## Foundations

### Color tokens

Map the palette onto shadcn CSS variables in `frontend/src/index.css`. Components read tokens only, never raw hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#00796B` | `#4DB6AC` | CTAs, active nav, key figures |
| `primary-foreground` | `#FFFFFF` | `#06231F` | Text on primary |
| `secondary` | `#607D8B` | `#78909C` | Secondary buttons, subdued UI |
| `accent` | `#8BC34A` | `#8BC34A` | Paid status, positive feedback |
| `accent-foreground` | `#1F2A14` | `#1F2A14` | Text on lime (white fails AA) |
| `background` | `#EEEEEE` | `#121212` | App canvas |
| `card`, `popover` | `#FFFFFF` | `#212121` | Cards, dialogs, forms |
| `foreground` | `#424242` | `#BDBDBD` | Body text |
| `muted` | `#E3E3E3` | `#2C2C2C` | Muted surfaces |
| `border`, `input` | `#D6D6D6` | `#3A3A3A` | Dividers, fields |
| `destructive` | `#E53935` | `#EF5350` | Overdue, deletes |
| `ring` | `primary` | `primary` | Focus rings |

Status semantics: PAID uses lime, PENDING uses amber, OVERDUE uses destructive. Chart series use a fixed ramp: teal, lime, gray-blue, amber, red.

### Typography

Inter for body, tables, and money. Space Grotesk for headings, stat numerals, and display moments. Money uses `tabular-nums` everywhere. Load both fonts with `<link>` tags in `index.html` and drop the CSS `@import` that triggers the PostCSS warning.

### Shape and motion

Radii: 8px controls, 10px cards, 14px dialogs. Two shadow levels for elevation. Motion runs 150–250ms ease-out for dialogs, dropdowns, stat-card entrance, and the command palette. All motion respects `prefers-reduced-motion`.

## App shell

A 44px icon rail plus a 240px flyout panel.

- **Rail**: section icons with the active item marked by a teal fill and lime ring. Brand mark at top, account menu at bottom.
- **Flyout**: shows the active section's pages. Hybrid interaction: hover peeks, click pins, keyboard focus opens. The pinned state persists across navigation.
- **Topbar**: breadcrumb or page title on the left, search trigger with `⌘K` on the right, plus theme toggle and account menu.
- **Command palette** (`cmdk` via shadcn `command`): navigation, new invoice, new client, theme and currency switches.
- **Mobile**: rail and flyout collapse into a hamburger-triggered sheet.

## Component system

shadcn/ui components (new-york style, Tailwind v4) land in `@/components/ui`:
`button input textarea select checkbox radio-group switch label form dialog alert-dialog sheet dropdown-menu popover tooltip tabs table badge avatar separator skeleton progress calendar command sonner scroll-area breadcrumb`

Domain components keep their role: `StatusBadge`, currency and date formatting helpers. Old hand-rolled primitives (`Button`, `Input`, `Card`, `Modal`, `Select`, `Badge`) are deleted once no file imports them.

Supporting choices:

- **Toasts**: keep the `useToast()` API and back it with sonner inside `ToastContext`. No call-site changes.
- **Forms**: react-hook-form + zod for New Invoice, Settings, and auth pages. Client schemas mirror backend validation rules and live in the frontend.
- **Tables**: TanStack Table for invoices, clients, and products (sort, filter, selection, pagination). Mobile keeps a card list.
- **Dates**: react-day-picker in a popover, sending date-only values at noon UTC through `dateOnlyToIso`.
- **21st.dev picks**: stat card with sparkline (Dashboard), table toolbar with filter chips (Invoices), empty-state illustrations (all lists), payment timeline (Invoice detail), upload dropzone (Settings logo), command palette skin.

## Page designs

### Phase 1: Foundations

Tokens, fonts, shadcn setup, primitives, the new shell, command palette, sonner adapter, restyled `StatusBadge`, and `data-testid` attributes on nav and key actions. Every existing page keeps working; only the shell and primitives change.

### Phase 2: Core pages

- **Dashboard (bento)**: hero revenue card with area chart, compact outstanding and paid-rate stats, status bars, recent invoices list.
- **Invoices list (ledger rows)**: borderless rows grouped by month, tabular amounts, status chips, hover checkboxes, dark bulk action bar, filter chips, pagination. Mobile shows cards.
- **New invoice (form + sticky summary)**: client and dates, line items, discount and VAT, notes on the left; totals and primary action in a sticky right column; summary stacks under items on mobile.
- **Invoice detail (document + rail)**: invoice rendered like the real document, status and actions in a right rail, payment timeline below. Actions: send, mark paid, PDF, duplicate, public link, delete.
- **Clients**: ledger rows; client detail keeps its own page with stat cards, contact card, and invoice ledger.
- **Products**: ledger rows with right-aligned prices and usage badges; create/edit moves to a sheet with the shared form.
- **Dialogs**: shadcn `dialog` on desktop, `sheet` on mobile, `alert-dialog` for destructive confirms.

### Phase 3: Remaining screens

- **Reports (analytics workspace)**: sticky filter bar, KPI row, full-width stacked chart, aging buckets, top clients, invoice list, export menu. jspdf and exceljs load through dynamic imports.
- **Settings**: Company and Account tabs as cards; company form gains a logo dropzone with preview; invoice defaults and account forms restyled.
- **Auth pages**: split layout with a teal brand panel and a form card; collapses to a centered card on mobile.
- **Public invoice (branded hero)**: teal header band with logo, invoice number, amount due and status; details and PDF download below.
- **Accessibility pass**: contrast audit, focus states, keyboard paths through shell and palette.

## Migration mechanics

1. Tokens and fonts first, so later work reads them.
2. Add shadcn primitives in Phase 1; migrate pages in phases; delete old primitives when `grep` finds no importers.
3. Add `data-testid` to nav items, primary buttons, and form fields as each page migrates.
4. Update `test-app.mjs` in the same phase as the UI change, keeping the check count.
5. Frontend-only, one focused commit set per phase.

## Verification

Per phase:

- `npx tsc -b` and `npm run lint` (0 problems) in `frontend/`.
- `node test-app.mjs` from the repo root, all 33 checks pass (both dev servers running).
- Playwright screenshot pass over each migrated page, light and dark.
- axe-core scan injected from CDN, no new dependency, covering contrast, labels, and landmarks.
- Manual check: keyboard-only navigation through the shell and command palette.

## Risks

- **Mixed styling during migration**: pages migrate phase by phase, so old and new styles coexist briefly. Each phase ends with a consistent checkpoint.
- **E2E selector churn**: the rail hides links until the flyout opens. `data-testid` attributes keep the tests stable.
- **Lime contrast**: white text on lime fails AA. All lime surfaces use charcoal text.
- **Dependency changes need a Vite restart**: observed earlier in this project. Restart the frontend dev server after adding packages.

## Out of scope

Backend and API changes, database work, ReportsPage i18n, new product features, and backend PDF template redesign.
