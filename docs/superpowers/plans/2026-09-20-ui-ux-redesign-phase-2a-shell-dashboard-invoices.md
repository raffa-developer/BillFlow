# UI/UX Redesign Phase 2a (Shell Animation, Dashboard, Invoices) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate the rail flyout, stage the legacy primitives, and rebuild the Dashboard and Invoices list on the new design system.

**Architecture:** The flyout becomes an always-mounted, width-animated panel. Legacy PascalCase primitives move to `*Legacy` files so the six deferred shadcn primitives can be generated without NTFS collisions. The Dashboard becomes a bento grid; the Invoices list becomes month-grouped ledger rows backed by TanStack Table for sorting and selection. Pages keep their existing data layer (React Query hooks, computations, URL-param filters).

**Tech Stack:** React 19, Vite, Tailwind v4, shadcn/ui, TanStack Table, Recharts, lucide-react, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-ui-ux-redesign-design.md`

## Global Constraints

- Frontend only. No changes under `backend/`.
- Palette tokens only (`bg-background`, `text-muted-foreground`, `bg-accent`, `text-accent-foreground`, `bg-destructive`, `border-border`, `bg-card`, `bg-primary`, `text-primary-foreground`, `bg-sidebar-*`). No raw hex except the PENDING amber already in `Badge.tsx`.
- New UI strings go into all six locales (`frontend/src/i18n/locales/{en,pt,es,fr,de,it}.ts`).
- Keep every `data-testid` used by `test-app.mjs` and `frontend/scripts/ui-verify.mjs`; update both files in the same task as any markup change they assert.
- `test-app.mjs` keeps 33 checks and stays locale-pinned to `en-US`.
- Verification commands from `frontend/`: `npx tsc -b`, `npm run lint`, `node scripts/ui-verify.mjs --screens --axe`. From the repo root: `node test-app.mjs` (always exits 0; read the summary).
- Both dev servers must be running (backend 4000, frontend 5173).
- Motion is 150-250ms ease-out and respects `motion-reduce:transition-none`.
- Commits follow Conventional Commits.

---

### Task 1: Flyout open/close animation

**Files:**
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/components/layout/Flyout.tsx`
- Modify: `frontend/scripts/ui-verify.mjs`
- Test: `frontend/scripts/ui-verify.mjs`

**Interfaces:**
- Consumes: `NAV_SECTIONS`, `activeSectionId` from `./nav`; existing peek/pin state in `AppShell`.
- Produces: `Flyout` renders content only (`section: NavSection | null`); the animated wrapper lives in `AppShell` with `data-testid="nav-flyout"` always in the DOM. Closed state is `width: 0; opacity: 0; pointer-events: none` so `isVisible()` is false.

- [ ] **Step 1: Change `Flyout.tsx` to a content-only component**

```tsx
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { NavSection } from './nav';

interface FlyoutProps {
  section: NavSection | null;
}

export function Flyout({ section }: FlyoutProps) {
  const { t } = useTranslation();
  if (!section) return null;

  return (
    <div className="w-56 px-2 py-3">
      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/60">
        {t(section.labelKey)}
      </p>
      <div className="space-y-0.5">
        {section.items.map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            end={item.href === '/'}
            data-testid={`nav-item-${item.id}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary/20 text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace the flyout render in `AppShell.tsx` with the animated wrapper**

Add near the other state (render-time adjustment, same pattern already used for the pathname sync):

```tsx
const [lastSection, setLastSection] = useState<string>(() => activeSectionId(pathname));
if (openSection && openSection !== lastSection) {
  setLastSection(openSection);
}
```

Replace the desktop block with:

```tsx
<div ref={navRef} onMouseLeave={scheduleClose} className="hidden lg:flex">
  <Rail
    openSection={openSection}
    onPeek={(s) => { cancelClose(); setPeek(s); }}
    onPin={(s) => { cancelClose(); setPinned(s); }}
    onTogglePin={(s) => setPinned((p) => (p === s ? null : s))}
  />
  <div
    data-testid="nav-flyout"
    aria-hidden={!openSection}
    className={cn(
      'h-full shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar-accent',
      'transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none',
      openSection ? 'w-56 opacity-100' : 'pointer-events-none w-0 border-r-0 opacity-0'
    )}
  >
    <Flyout section={NAV_SECTIONS.find((s) => s.id === lastSection) ?? null} />
  </div>
</div>
```

Add the `cn` import if missing. Keep the existing `navRef` outside-click effect and the Escape handler unchanged.

- [ ] **Step 3: Update the harness visibility assertions**

`nav-flyout` now stays in the DOM. Replace the two `count() === 0` assertions with visibility assertions and add a width check.

In `frontend/scripts/ui-verify.mjs`, replace the outside-click block with:

```js
  await goto('/');
  await page.getByTestId('nav-rail-finance').click();
  await page.waitForTimeout(250);
  check('flyout visible after pin', await page.getByTestId('nav-flyout').isVisible());
  await page.locator('main').click();
  await page.waitForTimeout(350);
  check('outside click unpins flyout', !(await page.getByTestId('nav-flyout').isVisible()));
```

Replace the Escape block with:

```js
  await page.getByTestId('nav-rail-finance').click();
  await page.waitForTimeout(250);
  check('flyout visible before escape', await page.getByTestId('nav-flyout').isVisible());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  check('escape dismisses flyout', !(await page.getByTestId('nav-flyout').isVisible()));
```

Add after the hover check:

```js
  const closedWidth = await page.getByTestId('nav-flyout').evaluate((el) => el.getBoundingClientRect().width);
  check('closed flyout has zero width', closedWidth === 0, String(closedWidth));
```

Place that check after the outside-click check (flyout closed at that point).

- [ ] **Step 4: Run the harness**

From `frontend/`: `node scripts/ui-verify.mjs`
Expected: `ALL CHECKS PASS`. The flyout visibly animates open and closed in a headed run; with `--screens` the dashboard shot shows the open flyout.

- [ ] **Step 5: Typecheck and lint**

From `frontend/`: `npx tsc -b` and `npm run lint` — exit 0 both.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/AppShell.tsx frontend/src/components/layout/Flyout.tsx frontend/scripts/ui-verify.mjs
git commit -m "feat(ui): animate the rail flyout open and close"
```

---

### Task 2: Stage legacy primitives and generate the deferred shadcn components

**Files:**
- Rename: `frontend/src/components/ui/{Button,Input,Select,Badge,Card,Modal}.tsx` → `*Legacy.tsx`
- Modify: every file importing those modules
- Create: `frontend/src/components/ui/{button,input,select,badge,calendar,alert-dialog}.tsx` (shadcn output)

**Interfaces:**
- Consumes: nothing.
- Produces: `@/components/ui/ButtonLegacy` etc. for pages not yet migrated, and lowercase shadcn primitives (`@/components/ui/button`, `input`, `select`, `badge`, `calendar`, `alert-dialog`) for Tasks 3-4 and Phase 2b.

- [ ] **Step 1: Rename the legacy files**

```bash
cd frontend/src/components/ui
git mv Button.tsx ButtonLegacy.tsx
git mv Input.tsx InputLegacy.tsx
git mv Select.tsx SelectLegacy.tsx
git mv Badge.tsx BadgeLegacy.tsx
git mv Card.tsx CardLegacy.tsx
git mv Modal.tsx ModalLegacy.tsx
```

- [ ] **Step 2: Rewrite the imports mechanically**

From `frontend/`:

```bash
npx --yes replace-in-file "components/ui/Button" "components/ui/ButtonLegacy" "src/**/*.{ts,tsx}" --isRegex=false
```

If `replace-in-file` is unavailable, use ripgrep plus an editor pass:

```bash
rg -l "components/ui/(Button|Input|Select|Badge|Card|Modal)" src
```

Replace each of the six module names with its `Legacy` counterpart in every listed file. Do not touch `components/ui/button.tsx`-style lowercase paths (none exist yet).

- [ ] **Step 3: Generate the six deferred primitives**

From `frontend/`:

```bash
npx shadcn@latest add button input select badge calendar alert-dialog --yes
```

- [ ] **Step 4: Verify nothing regressed**

From `frontend/`: `npx tsc -b` (0), `npm run lint` (0), `node scripts/ui-verify.mjs` (ALL CHECKS PASS).
From the repo root: `node test-app.mjs` (`QA SUMMARY: 33 passed, 0 failed`). The app must look and behave exactly as before this task.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui frontend/src
git commit -m "refactor(ui): stage legacy primitives and add shadcn button/input/select/badge/calendar/alert-dialog"
```

---

### Task 3: Dashboard bento redesign

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/i18n/locales/*.ts` (only if a key is missing)
- Modify: `frontend/scripts/ui-verify.mjs`
- Test: `frontend/scripts/ui-verify.mjs`, `node test-app.mjs`

**Interfaces:**
- Consumes: `@/components/ui/card`, `@/components/ui/badge`, `@/components/ui/button`, `StatusBadge`, `useCurrency`, `useTheme`, existing queries (`['clients']`, `['products']`, `['invoices']`) and `buildRevenueData`.
- Produces: test ids `dashboard-hero-revenue`, `dashboard-stat-outstanding`, `dashboard-stat-paid`, `dashboard-status-bars`, `dashboard-recent`.

- [ ] **Step 1: Keep the data layer, replace the render**

Keep everything from the top of `DashboardPage.tsx` through the derived values (`clients`, `products`, `invoices`, `revenue`, `pending`, `statusData`, `buildRevenueData`, `period` state) unchanged, except swapping legacy imports for `@/components/ui/card`, `@/components/ui/badge`, `@/components/ui/button` and `@/components/ui/BadgeLegacy` (StatusBadge).

Replace the returned JSX with:

```tsx
return (
  <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t('dashboard.title')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(`dashboard.period${p.charAt(0).toUpperCase() + p.slice(1)}`)}
          </button>
        ))}
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-5">
      <Card data-testid="dashboard-hero-revenue" className="lg:col-span-3 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.revenue')}</p>
        <p className="font-display mt-1 text-3xl font-bold tracking-tight text-foreground">{formatAmount(revenue)}</p>
        <div className="mt-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                formatter={(v) => formatAmount(Number(v))}
                contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2.5} fill="url(#revenueFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card data-testid="dashboard-stat-outstanding" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.receivable')}</p>
          <p className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground">{formatAmount(pending)}</p>
        </Card>
        <Card data-testid="dashboard-stat-paid" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.paidRate')}</p>
          <p className="font-display mt-1 text-2xl font-bold tracking-tight text-accent-foreground">
            {collectionRate}%
          </p>
        </Card>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-5">
      <Card data-testid="dashboard-status-bars" className="lg:col-span-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.byStatus')}</p>
        <div className="mt-4 space-y-3">
          {statusData.map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{s.label}</span>
                <span className="text-muted-foreground">{s.count} · {formatAmount(s.total)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', s.color)} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card data-testid="dashboard-recent" className="lg:col-span-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.recentInvoices')}</p>
          <Link to="/invoices" className="text-xs font-semibold text-primary hover:underline">{t('dashboard.viewAll')}</Link>
        </div>
        <div className="mt-3">
          {invoices.slice(0, 6).map((inv) => (
            <Link
              key={inv.id}
              to={`/invoices/${inv.id}`}
              className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0 hover:bg-muted/50"
            >
              <span className="font-mono text-xs font-bold text-foreground">{inv.number}</span>
              <span className="truncate text-xs text-muted-foreground">{inv.client.name}</span>
              <StatusBadge status={inv.status} className="ml-auto shrink-0" />
              <span className="w-24 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                {formatAmount(parseFloat(inv.total))}
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  </div>
);
```

Implementation notes:
- `collectionRate` = paid invoices / all invoices, rounded (`Math.round((paidCount / Math.max(invoices.length, 1)) * 100)`).
- `statusData` = for each of PAID/PENDING/OVERDUE: count, summed total, percentage of invoice count, and a bar color (`bg-accent`, `bg-[#FFB300]`, `bg-destructive`).
- `chartData` = `buildRevenueData(invoices, period)` (already exists).
- Add imports: `ResponsiveContainer`, `AreaChart`, `Area`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip` from `recharts`; `Link` from `react-router-dom`; `cn` from `@/lib/utils`.
- If `dashboard.paidRate` or `dashboard.viewAll` keys are missing, add them to all six locales (`en`: `Paid rate`, `View all`; pt: `Taxa de pagamento`, `Ver tudo`; es: `Tasa de pago`, `Ver todo`; fr: `Taux de paiement`, `Voir tout`; de: `Zahlungsquote`, `Alle anzeigen`; it: `Tasso di pagamento`, `Vedi tutto`).

- [ ] **Step 2: Add harness checks**

Append in the shell-check region, before the axe block:

```js
  await goto('/');
  for (const id of ['dashboard-hero-revenue', 'dashboard-stat-outstanding', 'dashboard-stat-paid', 'dashboard-status-bars', 'dashboard-recent']) {
    check(`dashboard bento: ${id}`, await page.getByTestId(id).isVisible());
  }
  await page.getByTestId('dashboard-recent').locator('a').first().click();
  await page.waitForLoadState('networkidle');
  check('recent invoice link navigates', page.url().includes('/invoices/'));
  await goto('/');
```

- [ ] **Step 3: Run the gates**

From `frontend/`: `node scripts/ui-verify.mjs --screens --axe` (ALL CHECKS PASS; axe stays clean in light and dark), `npx tsc -b` (0), `npm run lint` (0).
From the repo root: `node test-app.mjs` (33/33). Dashboard checks in `test-app.mjs` assert chart SVG count and numeric content, which the new markup still satisfies.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/i18n/locales frontend/scripts/ui-verify.mjs
git commit -m "feat(ui): rebuild the dashboard as a bento grid"
```

---

### Task 4: Invoices list as month-grouped ledger rows

**Files:**
- Modify: `frontend/src/pages/InvoicesPage.tsx`
- Modify: `test-app.mjs` (list selectors)
- Modify: `frontend/scripts/ui-verify.mjs`
- Test: both suites

**Interfaces:**
- Consumes: `@tanstack/react-table` (`useReactTable`, `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel`, `flexRender`), shadcn `button`/`input`/`select`/`badge`, `StatusBadge` from `@/components/ui/BadgeLegacy`.
- Produces: ledger rows with `data-testid="invoice-row-<id>"`, group headers `data-testid="invoice-group-<yyyy-mm>"`, selection checkboxes `data-testid="invoice-select-<id>"`, and the existing bulk bar with `data-testid="bulk-bar"`.

- [ ] **Step 1: Keep the data/filter layer, swap the table**

Add `useNavigate` to the existing `react-router-dom` import and `useState` to the React import; import `useReactTable`, `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel` and types `ColumnDef`, `SortingState`, `Updater`, `RowSelectionState` from `@tanstack/react-table`. Swap the legacy `Card`/`Button` imports for `@/components/ui/card` and `@/components/ui/button`; keep `StatusBadge` from `@/components/ui/BadgeLegacy` and the delete `Modal` from `@/components/ui/ModalLegacy` (Phase 2b replaces it).

Keep: the `useQuery(['invoices'])`, URL-param filter state (`q`, `status`, `from`, `to`, `min`, `max`, `sort`), `filterKey` render-time reset, delete/bulk mutations, modals, pagination state.

Replace the filtering/sorting/pagination computation with TanStack Table:

```tsx
const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

const columns = useMemo<ColumnDef<Invoice>[]>(() => [
  { id: 'select', header: () => null, cell: () => null, enableSorting: false },
  { id: 'number', accessorFn: (i) => i.number, header: t('invoices.colNumber') },
  { id: 'client', accessorFn: (i) => i.client.name, header: t('invoices.colClient') },
  { id: 'issued', accessorFn: (i) => new Date(i.dateIssued).getTime(), header: t('invoices.colIssued') },
  { id: 'status', accessorFn: (i) => i.status, header: t('invoices.colStatus') },
  { id: 'total', accessorFn: (i) => parseFloat(i.total), header: t('invoices.colTotal') },
], [t]);

const table = useReactTable({
  data: all,
  columns,
  state: {
    sorting,
    rowSelection,
    globalFilter: search,
    columnFilters: [
      ...(statusFilter ? [{ id: 'status', value: statusFilter }] : []),
      ...(minTotal ? [{ id: 'total', value: minTotal }] : []),
    ],
  },
  onSortingChange: handleSortingChange,
  onRowSelectionChange: setRowSelection,
  getRowId: (row) => String(row.id),
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
});
```

Mapping notes:

```tsx
// URL param <-> TanStack sorting
const SORT_TO_STATE: Record<SortKey, SortingState> = {
  date_desc: [{ id: 'issued', desc: true }],
  date_asc: [{ id: 'issued', desc: false }],
  due_asc: [{ id: 'issued', desc: false }],
  due_desc: [{ id: 'issued', desc: true }],
  total_desc: [{ id: 'total', desc: true }],
  total_asc: [{ id: 'total', desc: false }],
  number_asc: [{ id: 'number', desc: false }],
};
const [sorting, setSorting] = useState<SortingState>(SORT_TO_STATE[sort] ?? SORT_TO_STATE.date_desc);
const handleSortingChange = (updater: Updater<SortingState>) => {
  const next = typeof updater === 'function' ? updater(sorting) : updater;
  setSorting(next);
  const first = next[0];
  if (!first) return;
  const key = (Object.entries(SORT_TO_STATE).find(([, s]) => s[0]?.id === first.id && s[0]?.desc === first.desc)?.[0] ?? 'date_desc') as SortKey;
  setParam('sort', key);
};
```

- `search` ↔ `globalFilter` with `globalFilterFn: 'includesString'` and accessor functions on `number` and `client` (return `` `${i.number} ${i.client.name}` `` for the client column is not needed; set `globalFilterFn` per column: `number: 'includesString'`, `client: 'includesString'`).
- Date and amount range filters are `filterFn`s on `issued` and `total` reading `dateFrom`/`dateTo`/`minTotal`/`maxTotal` from the URL params (return false when outside the range).
- Keep the existing page-reset render-time block keyed on `filterKey`; also call `setRowSelection({})` there.

Add the locale keys used by the new markup to all six locales:

| key | en | pt | es | fr | de | it |
|---|---|---|---|---|---|---|
| `invoices.colNumber` | Number | Número | Número | Numéro | Nummer | Numero |
| `invoices.colClient` | Client | Cliente | Cliente | Client | Kunde | Cliente |
| `invoices.colIssued` | Issued | Emitida | Emitida | Émise | Ausgestellt | Emessa |
| `invoices.colStatus` | Status | Estado | Estado | Statut | Status | Stato |
| `invoices.colTotal` | Total | Total | Total | Total | Gesamt | Totale |
| `invoices.selected_one` | {{count}} selected | {{count}} selecionada | {{count}} seleccionada | {{count}} sélectionnée | {{count}} ausgewählt | {{count}} selezionata |
| `invoices.selected_other` | {{count}} selected | {{count}} selecionadas | {{count}} seleccionadas | {{count}} sélectionnées | {{count}} ausgewählt | {{count}} selezionate |
| `invoices.bulkMarkPaid` | Mark paid | Marcar como paga | Marcar como pagada | Marquer payée | Als bezahlt markieren | Segna come pagata |

- [ ] **Step 2: Render ledger rows grouped by month**

```tsx
const selectedIds = new Set(Object.keys(rowSelection).map(Number));
const filteredRows = table.getFilteredRowModel().rows;
const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
const safePage = Math.min(page, totalPages);
const rows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
const grouped = new Map<string, typeof rows>();
for (const row of rows) {
  const key = row.original.dateIssued.slice(0, 7); // yyyy-mm
  grouped.set(key, [...(grouped.get(key) ?? []), row]);
}

return (
  <div className="space-y-5">
    {/* header, filter chips and search keep their current testids and handlers */}

    <Card className="overflow-hidden">
      {[...grouped.entries()].map(([month, monthRows]) => (
        <div key={month}>
          <p
            data-testid={`invoice-group-${month}`}
            className="bg-muted/50 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            {new Date(`${month}-01T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
          {monthRows.map((row) => {
            const inv = row.original;
            const selected = row.getIsSelected();
            return (
              <div
                key={inv.id}
                data-testid={`invoice-row-${inv.id}`}
                onClick={() => navigate(`/invoices/${inv.id}`)}
                className={cn(
                  'group flex cursor-pointer items-center gap-3 border-b border-border px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/40',
                  selected && 'bg-primary/5'
                )}
              >
                <input
                  type="checkbox"
                  data-testid={`invoice-select-${inv.id}`}
                  checked={selected}
                  onClick={(e) => e.stopPropagation()}
                  onChange={row.getToggleSelectedHandler()}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <span className="w-24 font-mono text-xs font-bold text-foreground">{inv.number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{inv.client.name}</span>
                <StatusBadge status={inv.status} className="shrink-0" />
                <span className="w-28 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-foreground">
                  {formatAmount(parseFloat(inv.total))}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>}
    </Card>

    {/* pagination controls keep the existing testids and safePage logic, driven by table.getState().pagination */}

    {selectedIds.size > 0 && (
      <div data-testid="bulk-bar" className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-sidebar-background px-4 py-2.5 text-xs font-semibold text-sidebar-foreground shadow-lg">
        <span>{t('invoices.selected', { count: selectedIds.size })}</span>
        <button className="text-accent" onClick={() => bulkMarkPaidMutation.mutate()}>{t('invoices.bulkMarkPaid')}</button>
        <button className="text-destructive" onClick={() => setBulkDeleteOpen(true)}>{t('common.delete')}</button>
      </div>
    )}
  </div>
);
```

Keep the mobile card list: render it below `lg` from `rows` with the same row click handler and status badge; it must keep responsive classes so `test-app.mjs`'s mobile CSS check passes (`sm:hidden`, `hidden sm:block`).

- [ ] **Step 3: Update `test-app.mjs` selectors**

- Section [6]: `page.locator('table tbody tr').count()` → `page.locator('[data-testid^="invoice-row-"]').count()`.
- Section [7]: `page.locator('table tbody tr').first().click()` → `page.locator('[data-testid^="invoice-row-"]').first().click()`.
- The mobile CSS check keeps looking for `sm:hidden`/`hidden sm:` classes, which the mobile card list still emits.

- [ ] **Step 4: Add harness checks**

```js
  await goto('/invoices');
  check('ledger group header present', (await page.locator('[data-testid^="invoice-group-"]').count()) > 0);
  const firstRow = page.locator('[data-testid^="invoice-row-"]').first();
  check('ledger row present', await firstRow.isVisible());
  await firstRow.locator('input[type=checkbox]').click();
  await page.waitForTimeout(200);
  check('bulk bar appears on selection', await page.getByTestId('bulk-bar').isVisible());
  await page.keyboard.press('Escape');
  await firstRow.click();
  await page.waitForLoadState('networkidle');
  check('ledger row opens detail', /\/invoices\/\d+/.test(page.url()));
```

- [ ] **Step 5: Run the gates**

From `frontend/`: `node scripts/ui-verify.mjs --screens --axe` (ALL CHECKS PASS), `npx tsc -b` (0), `npm run lint` (0).
From the repo root: `node test-app.mjs` (33/33).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/InvoicesPage.tsx frontend/scripts/ui-verify.mjs test-app.mjs frontend/src/i18n/locales
git commit -m "feat(ui): rebuild the invoices list as ledger rows"
```

---

### Task 5: Phase 2a verification

**Files:**
- Modify: `AGENTS.md` (only if the harness or conventions changed)

**Interfaces:**
- Consumes: everything above.
- Produces: a verified Phase 2a checkpoint.

- [ ] **Step 1: Full verification**

From `frontend/`: `npx tsc -b`, `npm run lint`, `node scripts/ui-verify.mjs --screens --axe`.
From the repo root: `node test-app.mjs`.
Expected: 0, 0, ALL CHECKS PASS (light + dark axe, zero serious/critical), 33/33.

- [ ] **Step 2: Visual check**

Open the screenshots directory the harness prints. Confirm the flyout animation frames, the bento dashboard, and the ledger list in light and dark.

- [ ] **Step 3: Commit (only if files changed)**

```bash
git add AGENTS.md
git commit -m "docs: record phase 2a verification notes"
```

---

## Phase 2a exit criteria

- Flyout animates open and closed in 200ms, disabled under `prefers-reduced-motion`, and `isVisible()` is false when closed.
- Legacy primitives are staged as `*Legacy` and the six deferred shadcn primitives exist; the app behaves identically before the page work starts.
- Dashboard and Invoices match the approved designs, axe stays clean in both themes, E2E 33/33.
- No `backend/` changes.

## Next plan

Phase 2b (New Invoice form + sticky summary, Invoice detail document + rail, Clients, Products) gets its own plan after Phase 2a lands.
