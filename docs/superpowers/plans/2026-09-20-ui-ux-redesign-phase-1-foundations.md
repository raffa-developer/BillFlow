# UI/UX Redesign Phase 1 (Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BillFlow's visual foundation (tokens, fonts, primitives, shell, toasts) with the teal/lime design system and the rail + flyout navigation, keeping every page working.

**Architecture:** Tokens land first in `frontend/src/index.css` and fonts in `index.html`. shadcn/ui primitives are added into `@/components/ui`. The existing `Layout` is rebuilt as an app shell (icon rail + hybrid flyout + topbar) with a cmdk command palette. The custom toast system keeps its `useToast()` API but runs on sonner. Page internals are not redesigned in this phase.

**Tech Stack:** React 19, Vite, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui (new-york), Radix primitives, sonner, cmdk, lucide-react, Playwright (root) for verification.

**Spec:** `docs/superpowers/specs/2026-09-20-ui-ux-redesign-design.md`

## Global Constraints

- Frontend only. No changes under `backend/`.
- Palette values are exact: primary `#00796B` light / `#4DB6AC` dark, accent `#8BC34A` with charcoal text `#1F2A14`, background `#EEEEEE` light / `#121212` dark, card `#FFFFFF` light / `#212121` dark, foreground `#424242` light / `#BDBDBD` dark, secondary `#607D8B` light / `#78909C` dark, destructive `#E53935` light / `#EF5350` dark.
- New UI strings go into all six locale files: `frontend/src/i18n/locales/{en,pt,es,fr,de,it}.ts`.
- `test-app.mjs` keeps 33 checks and stays locale-pinned to `en-US`.
- Verification commands run from the package dir unless stated: `npx tsc -b`, `npm run lint` (frontend), `node test-app.mjs` (repo root).
- Both dev servers must be running for Playwright checks: backend `:4000`, frontend `:5173`.
- After adding npm packages, restart the Vite dev server (stale optimize cache causes 504s).
- Commits follow Conventional Commits.

---

### Task 1: Verification harness

**Files:**
- Create: `frontend/scripts/ui-verify.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `node scripts/ui-verify.mjs [--screens] [--axe]` exits non-zero when a check fails. Later tasks add checks to the `CHECKS` array. Env overrides: `APP_URL` (default `http://localhost:5173`), `API_URL` (default `http://localhost:4000/api`), `VERIFY_EMAIL` / `VERIFY_PASSWORD` (default demo account).

- [ ] **Step 1: Write the harness**

```js
// frontend/scripts/ui-verify.mjs
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:4000/api';
const APP = process.env.APP_URL ?? 'http://localhost:5173';
const EMAIL = process.env.VERIFY_EMAIL ?? 'demo@billflow.com';
const PASSWORD = process.env.VERIFY_PASSWORD ?? 'Demo1234!';
const WANT_SCREENS = process.argv.includes('--screens');
const WANT_AXE = process.argv.includes('--axe');

const failures = [];
function check(name, ok, detail = '') {
  console.log(`${ok ? '  PASS' : '  FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures.push(name);
}

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return (await res.json()).token;
}

async function run() {
  const token = await login();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((t) => localStorage.setItem('token', t), token);
  const page = await ctx.newPage();

  const shots = WANT_SCREENS ? mkdtempSync(join(tmpdir(), 'billflow-ui-')) : null;

  const goto = async (path) => {
    await page.goto(APP + path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
  };
  const shot = async (name) => {
    if (!shots) return;
    await page.screenshot({ path: join(shots, `${name}.png`), fullPage: false });
  };

  // --- token checks (Task 2) ---
  await goto('/login');
  const primary = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toLowerCase());
  check('primary token is teal', primary === '#00796b', primary);

  const darkBg = await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    const v = getComputedStyle(document.documentElement).getPropertyValue('--background').trim().toLowerCase();
    document.documentElement.classList.remove('dark');
    return v;
  });
  check('dark background token', darkBg === '#121212', darkBg);

  // --- shell checks (Task 5) ---
  // --- palette checks (Task 6) ---
  // --- badge checks (Task 7) ---
  // Later tasks append their assertions above this line.

  if (WANT_AXE) {
    await goto('/');
    await page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.10.2/axe.min.js' });
    const result = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    }));
    const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check('axe: no serious/critical violations on dashboard', serious.length === 0,
      serious.map((v) => v.id).join(', '));
  }

  if (shots) console.log(`\nScreenshots: ${shots}`);
  await browser.close();

  console.log(`\n${failures.length === 0 ? 'ALL CHECKS PASS' : `${failures.length} CHECK(S) FAILED`}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run it against the current app**

Run from `frontend/`: `node scripts/ui-verify.mjs`
Expected: the two token checks FAIL (old palette), exit code 1. This proves the harness works.

- [ ] **Step 3: Commit**

```bash
git add frontend/scripts/ui-verify.mjs
git commit -m "test(ui): add Playwright verification harness"
```

---

### Task 2: Design tokens and fonts

**Files:**
- Modify: `frontend/src/index.css` (replace `@theme` block, delete the Google Fonts `@import` line)
- Modify: `frontend/index.html` (font links)
- Test: `frontend/scripts/ui-verify.mjs` (token checks already written)

**Interfaces:**
- Consumes: harness from Task 1.
- Produces: CSS variables `--primary`, `--primary-foreground`, `--secondary`, `--accent`, `--accent-foreground`, `--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--border`, `--input`, `--ring`, `--destructive`, plus `--font-display`. All later components read these.

- [ ] **Step 1: Replace the token block in `index.css`**

Replace everything from `@theme {` through the end of the `.dark { ... }` block with:

```css
@theme {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Space Grotesk', 'Inter', system-ui, sans-serif;

  --color-primary-50: #e0f2f1;
  --color-primary-100: #b2dfdb;
  --color-primary-200: #80cbc4;
  --color-primary-300: #4db6ac;
  --color-primary-400: #26a69a;
  --color-primary-500: #009688;
  --color-primary-600: #00796b;
  --color-primary-700: #00695c;
  --color-primary-800: #004d40;
  --color-primary-900: #00332c;

  --background: #eeeeee;
  --foreground: #424242;
  --card: #ffffff;
  --card-foreground: #424242;
  --popover: #ffffff;
  --popover-foreground: #424242;
  --primary: #00796b;
  --primary-foreground: #ffffff;
  --secondary: #607d8b;
  --secondary-foreground: #ffffff;
  --muted: #e3e3e3;
  --muted-foreground: #6b6b6b;
  --accent: #8bc34a;
  --accent-foreground: #1f2a14;
  --destructive: #e53935;
  --destructive-foreground: #ffffff;
  --border: #d6d6d6;
  --input: #d6d6d6;
  --ring: #00796b;
  --radius: 0.5rem;
  --sidebar-background: #141817;
  --sidebar-foreground: #f8fafc;
  --sidebar-primary: #00796b;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #232927;
  --sidebar-accent-foreground: #e8efed;
  --sidebar-border: #232927;
  --sidebar-ring: #8bc34a;
}

:root {
  --toast-bg: #ffffff;
  --toast-text: #424242;
  --toast-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  --toast-border: #d6d6d6;
}

.dark {
  --background: #121212;
  --foreground: #bdbdbd;
  --card: #212121;
  --card-foreground: #e0e0e0;
  --popover: #212121;
  --popover-foreground: #e0e0e0;
  --primary: #4db6ac;
  --primary-foreground: #06231f;
  --secondary: #78909c;
  --secondary-foreground: #10181c;
  --muted: #2c2c2c;
  --muted-foreground: #9e9e9e;
  --accent: #8bc34a;
  --accent-foreground: #1f2a14;
  --destructive: #ef5350;
  --destructive-foreground: #1b0a0a;
  --border: #3a3a3a;
  --input: #3a3a3a;
  --ring: #4db6ac;
  --toast-bg: #212121;
  --toast-text: #e0e0e0;
  --toast-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
  --toast-border: #3a3a3a;
}
```

Delete the `@import url('https://fonts.googleapis.com/css2?family=Inter...')` line wherever it appears in the file.

- [ ] **Step 2: Add font links to `index.html`**

Inside `<head>`, before the title or module script:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 3: Run the harness**

Run from `frontend/`: `node scripts/ui-verify.mjs`
Expected: both token checks PASS, `ALL CHECKS PASS`.

- [ ] **Step 4: Typecheck and lint**

Run from `frontend/`: `npx tsc -b` then `npm run lint`
Expected: exit 0 both, no PostCSS `@import` warning in the dev server log after reload.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/index.html
git commit -m "feat(ui): adopt teal/lime design tokens and display font"
```

---

### Task 3: shadcn/ui primitives and stack dependencies

**Files:**
- Create: `frontend/src/components/ui/*` (shadcn output)
- Modify: `frontend/package.json`, `frontend/package-lock.json`

**Interfaces:**
- Consumes: `components.json` (already present: new-york, css variables, aliases).
- Produces: importable primitives for Tasks 4-9 and Phases 2-3, including `@/components/ui/sonner`, `@/components/ui/command`, `@/components/ui/sheet`, `@/components/ui/dialog`, `@/components/ui/dropdown-menu`.

- [ ] **Step 1: Install the stack dependencies**

Run from `frontend/`:

```bash
npm i sonner cmdk @tanstack/react-table react-hook-form zod @hookform/resolvers react-day-picker motion
```

- [ ] **Step 2: Add shadcn primitives**

Run from `frontend/`:

```bash
npx shadcn@latest add button input textarea select checkbox radio-group switch label form dialog alert-dialog sheet dropdown-menu popover tooltip tabs table badge avatar separator skeleton progress calendar command sonner scroll-area breadcrumb --yes
```

- [ ] **Step 3: Protect the tokens**

Run: `git diff frontend/src/index.css`
If the CLI changed token values, restore the Task 2 block (`git checkout -- frontend/src/index.css` then re-apply Task 2 edits). The token values from the spec win.

- [ ] **Step 4: Verify build**

Run from `frontend/`: `npx tsc -b` then `npm run lint`
Expected: exit 0 both. If shadcn added unused-import errors, fix them in the generated files.

- [ ] **Step 5: Restart the Vite dev server**

Kill the frontend dev process and start it again (`npm run dev` from `frontend/`), because dependency additions invalidate Vite's optimize cache. Confirm `http://localhost:5173` returns 200.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/ui
git commit -m "build(ui): add shadcn/ui primitives and modern UI stack"
```

---

### Task 4: Sonner toast adapter

**Files:**
- Modify: `frontend/src/contexts/ToastContext.tsx` (full rewrite)
- Check: `grep -rn "Toaster" frontend/src` before deleting the old export

**Interfaces:**
- Consumes: `@/components/ui/sonner` from Task 3.
- Produces: unchanged `useToast()` API returning `{ toast: { success(msg), error(msg), info(msg) } }`. All ~20 call sites keep working.

- [ ] **Step 1: Confirm nothing imports the old Toaster export**

Run from `frontend/`: `npx rg "Toaster" src` (or `Select-String`).
Expected: only `ToastContext.tsx` matches. If pages import it, update them to remove the import in this task.

- [ ] **Step 2: Rewrite `ToastContext.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { toast as sonner } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const toast = {
    success: (message: string) => sonner.success(message),
    error: (message: string) => sonner.error(message),
    info: (message: string) => sonner.info(message),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
```

- [ ] **Step 3: Add a harness check for toasts**

Append to `ui-verify.mjs` before the axe block:

```js
  // --- toast adapter (Task 4) ---
  await goto('/settings');
  await page.getByTestId('settings-company-submit').click();
  await page.waitForTimeout(900);
  const toastVisible = await page.locator('[data-sonner-toast]').count();
  check('sonner toast renders on settings save', toastVisible > 0, String(toastVisible));
```

The `settings-company-submit` testid does not exist yet. Add it in this task: in `frontend/src/pages/SettingsPage.tsx`, on the company form's submit `Button`, add `data-testid="settings-company-submit"`.

- [ ] **Step 4: Run the harness**

Run from `frontend/`: `node scripts/ui-verify.mjs`
Expected: token checks PASS, toast check PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/ToastContext.tsx frontend/src/pages/SettingsPage.tsx frontend/scripts/ui-verify.mjs
git commit -m "refactor(ui): back useToast with sonner"
```

---

### Task 5: App shell (rail, flyout, topbar, mobile sheet)

**Files:**
- Create: `frontend/src/components/layout/nav.ts`
- Create: `frontend/src/components/layout/Rail.tsx`
- Create: `frontend/src/components/layout/Flyout.tsx`
- Create: `frontend/src/components/layout/Topbar.tsx`
- Create: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/components/layout/Layout.tsx` (render `AppShell`)
- Delete: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/i18n/locales/*.ts` (add `nav.main`, `nav.finance`, `nav.system`; move nothing else)
- Test: `frontend/scripts/ui-verify.mjs`

**Interfaces:**
- Consumes: primitives (Task 3), tokens (Task 2).
- Produces:
  - `NAV_SECTIONS: { id: string; labelKey: string; items: { id: string; href: string; labelKey: string; icon: LucideIcon }[] }[]`
  - Test ids used by tests and later phases: `nav-rail-<sectionId>`, `nav-item-<itemId>`, `topbar-command`, `topbar-account`, `account-logout`, `topbar-language`, `topbar-currency`, `topbar-menu` (mobile), `nav-mobile-<itemId>`.
  - Shell behavior: hover peeks, click pins, focus opens, Escape closes, outside click unpins.

- [ ] **Step 1: Create `nav.ts`**

```ts
import { LayoutDashboard, FileText, Users, Package, BarChart2, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface NavSection {
  id: string;
  labelKey: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    labelKey: 'nav.main',
    items: [
      { id: 'dashboard', href: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { id: 'invoices', href: '/invoices', labelKey: 'nav.invoices', icon: FileText },
      { id: 'clients', href: '/clients', labelKey: 'nav.clients', icon: Users },
    ],
  },
  {
    id: 'finance',
    labelKey: 'nav.finance',
    items: [
      { id: 'products', href: '/products', labelKey: 'nav.products', icon: Package },
      { id: 'reports', href: '/reports', labelKey: 'nav.reports', icon: BarChart2 },
    ],
  },
  {
    id: 'system',
    labelKey: 'nav.system',
    items: [
      { id: 'settings', href: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
];

export function activeSectionId(pathname: string): string {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
      if (isActive) return section.id;
    }
  }
  return 'main';
}
```

- [ ] **Step 2: Create `Rail.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS, activeSectionId } from './nav';

interface RailProps {
  openSection: string | null;
  onPeek: (section: string) => void;
  onTogglePin: (section: string) => void;
}

export function Rail({ openSection, onPeek, onTogglePin }: RailProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const active = activeSectionId(pathname);

  return (
    <nav
      aria-label={t('nav.menu')}
      className="flex h-full w-11 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar-background py-2"
    >
      {NAV_SECTIONS.map((section) => {
        const Icon = section.items[0].icon;
        const isActive = section.id === active;
        const isOpen = section.id === openSection;
        return (
          <button
            key={section.id}
            type="button"
            data-testid={`nav-rail-${section.id}`}
            aria-label={t(section.labelKey)}
            aria-expanded={isOpen}
            onMouseEnter={() => onPeek(section.id)}
            onFocus={() => onPeek(section.id)}
            onClick={() => onTogglePin(section.id)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isActive && 'bg-sidebar-primary text-sidebar-primary-foreground',
              isOpen && !isActive && 'ring-2 ring-sidebar-ring/60'
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </nav>
  );
}
```

`NavLink` is not used in this file.

- [ ] **Step 3: Create `Flyout.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS } from './nav';

interface FlyoutProps {
  openSection: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function Flyout({ openSection, onMouseEnter, onMouseLeave }: FlyoutProps) {
  const { t } = useTranslation();
  const section = NAV_SECTIONS.find((s) => s.id === openSection);
  if (!section) return null;

  return (
    <div
      data-testid="nav-flyout"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex h-full w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar-accent/60 px-2 py-3"
    >
      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
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

- [ ] **Step 4: Create `Topbar.tsx`**

This replaces the language/currency selects and account menu that lived in `Sidebar.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Menu, Moon, Search, Sun, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTheme } from '@/contexts/ThemeContext';
import { languages } from '@/i18n';
import { NAV_SECTIONS } from './nav';

interface TopbarProps {
  onOpenCommand: () => void;
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenCommand, onOpenMobileNav }: TopbarProps) {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { currency, changeCurrency, converting } = useCurrency();
  const { theme, toggleTheme } = useTheme();
  const [accountOpen, setAccountOpen] = useState(false);

  const activeItem = NAV_SECTIONS.flatMap((s) => s.items).find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  );

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 lg:px-4">
      <button
        data-testid="topbar-menu"
        onClick={onOpenMobileNav}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="text-sm font-semibold text-foreground">
        {activeItem ? t(activeItem.labelKey) : 'BillFlow'}
      </h1>
      <div className="flex-1" />
      <button
        data-testid="topbar-command"
        onClick={onOpenCommand}
        className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        {t('nav.searchPlaceholder')}
        <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>
      <button
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <select
        data-testid="topbar-language"
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="hidden rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground md:block"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
      <select
        data-testid="topbar-currency"
        value={currency}
        disabled={converting}
        onChange={(e) => changeCurrency(e.target.value as typeof currency)}
        className="hidden rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground md:block"
      >
        {(['EUR', 'BRL', 'USD', 'GBP'] as const).map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div className="relative">
        <button
          data-testid="topbar-account"
          onClick={() => setAccountOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground lg:block">{user?.email}</span>
          <ChevronsUpDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
        </button>
        {accountOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-popover py-1.5 shadow-lg">
            <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user?.email}</p>
            <button
              data-testid="account-logout"
              onClick={() => { logout(); setAccountOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('nav.logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Create `AppShell.tsx`**

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Rail } from './Rail';
import { Flyout } from './Flyout';
import { Topbar } from './Topbar';
import { NAV_SECTIONS, activeSectionId } from './nav';

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [peek, setPeek] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const openSection = pinned ?? peek;

  useEffect(() => { setMobileNavOpen(false); }, [pathname]);
  useEffect(() => { setPeek(activeSectionId(pathname)); }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPeek(null), 150);
  };
  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex">
        <Rail
          openSection={openSection}
          onPeek={(s) => { cancelClose(); setPeek(s); }}
          onTogglePin={(s) => setPinned((p) => (p === s ? null : s))}
        />
        <Flyout openSection={openSection} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar-background p-0">
          <nav className="flex flex-col gap-1 p-3">
            {NAV_SECTIONS.flatMap((s) => s.items).map((item) => (
              <NavLink
                key={item.id}
                to={item.href}
                end={item.href === '/'}
                data-testid={`nav-mobile-${item.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenCommand={() => { /* wired in Task 6 */ }}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

Task 6 replaces the `onOpenCommand` stub with palette state, the `⌘K` handler, and the `<CommandPalette>` render.

- [ ] **Step 6: Wire `Layout.tsx`, delete `Sidebar.tsx`**

`Layout.tsx` keeps the auth loading spinner and `Navigate to="/login"`, then renders `<AppShell>{children}</AppShell>`. Delete `Sidebar.tsx`. Remove its imports everywhere (`npx rg "Sidebar" frontend/src`).

- [ ] **Step 7: Add locale keys**

Add to every locale file under the `nav` namespace:

| key | en | pt | es | fr | de | it |
|---|---|---|---|---|---|---|
| `main` | Main | Principal | Principal | Principal | Haupt | Principale |
| `finance` | Finance | Finanças | Finanzas | Finance | Finanzen | Finanza |
| `system` | System | Sistema | Sistema | Système | System | Sistema |
| `searchPlaceholder` | Search pages and actions… | Pesquisar páginas e ações… | Buscar páginas y acciones… | Rechercher pages et actions… | Seiten und Aktionen suchen… | Cerca pagine e azioni… |
| `lightMode` | Switch to light mode | Mudar para modo claro | Cambiar a modo claro | Passer en mode clair | Zum hellen Modus wechseln | Passa al tema chiaro |
| `darkMode` | Switch to dark mode | Mudar para modo escuro | Cambiar a modo oscuro | Passer en mode sombre | Zum dunklen Modus wechseln | Passa al tema scuro |

- [ ] **Step 8: Add shell checks to the harness**

```js
  // --- shell (Task 5) ---
  await goto('/');
  check('rail visible', await page.getByTestId('nav-rail-main').isVisible());
  await page.getByTestId('nav-rail-finance').hover();
  await page.waitForTimeout(300);
  check('hover opens flyout', await page.getByTestId('nav-flyout').isVisible());
  await page.getByTestId('nav-rail-finance').click();
  await page.waitForTimeout(200);
  await page.getByTestId('nav-item-reports').click();
  await page.waitForLoadState('networkidle');
  check('flyout navigates to reports', page.url().endsWith('/reports'));
  await page.setViewportSize({ width: 390, height: 844 });
  await goto('/');
  await page.getByTestId('topbar-menu').click();
  await page.waitForTimeout(400);
  check('mobile nav sheet opens', await page.getByTestId('nav-mobile-invoices').isVisible());
  await page.setViewportSize({ width: 1280, height: 800 });
```

- [ ] **Step 9: Run the harness**

Run from `frontend/`: `node scripts/ui-verify.mjs`
Expected: all checks PASS.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/layout frontend/src/pages frontend/src/i18n/locales
git rm frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(ui): replace sidebar with rail and flyout app shell"
```

---

### Task 6: Command palette

**Files:**
- Create: `frontend/src/components/layout/CommandPalette.tsx`
- Test: `frontend/scripts/ui-verify.mjs`

**Interfaces:**
- Consumes: `@/components/ui/command` (Task 3), `NAV_SECTIONS` (Task 5), `useTheme` from `@/contexts/ThemeContext`.
- Produces: `<CommandPalette open={boolean} onOpenChange={(v: boolean) => void} />`. Test ids: `command-input`, `command-item-<id>`.

- [ ] **Step 1: Implement the palette**

Create `frontend/src/components/layout/CommandPalette.tsx`. Then wire it into `AppShell.tsx`:
1. Add `const [commandOpen, setCommandOpen] = useState(false);`
2. Extend the existing keydown effect with the `⌘K` / `Ctrl+K` toggle (prevent default, `setCommandOpen((v) => !v)`) and add `setCommandOpen(false)` to the Escape branch.
3. Replace the `onOpenCommand` stub with `() => setCommandOpen(true)`.
4. Render `<CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />` after the closing `</div>` of the main column, inside the root div.

```tsx
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from '@/components/ui/command';
import { useTheme } from '@/contexts/ThemeContext';
import { NAV_SECTIONS } from './nav';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const go = (href: string) => { onOpenChange(false); navigate(href); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput data-testid="command-input" placeholder={t('nav.searchPlaceholder')} />
      <CommandList>
        <CommandEmpty>{t('common.noResults')}</CommandEmpty>
        {NAV_SECTIONS.map((section) => (
          <CommandGroup key={section.id} heading={t(section.labelKey)}>
            {section.items.map((item) => (
              <CommandItem
                key={item.id}
                data-testid={`command-item-${item.id}`}
                value={t(item.labelKey)}
                onSelect={() => go(item.href)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {t(item.labelKey)}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandGroup heading={t('nav.actions')}>
          <CommandItem value={t('nav.newInvoice')} onSelect={() => go('/invoices/new')}>
            {t('nav.newInvoice')}
          </CommandItem>
          <CommandItem value={t('nav.toggleTheme')} onSelect={() => { toggleTheme(); onOpenChange(false); }}>
            {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 2: Add locale keys**

Add to all six locales under `nav`: `actions` (en: `Actions`), `newInvoice` (en: `New invoice`), `toggleTheme` (en: `Toggle theme`). Translate for pt/es/fr/de/it in the same commit.

- [ ] **Step 3: Harness check**

```js
  // --- command palette (Task 6) ---
  await goto('/');
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(400);
  check('command palette opens', await page.getByTestId('command-input').isVisible());
  await page.getByTestId('command-input').fill('invoices');
  await page.waitForTimeout(300);
  await page.getByTestId('command-item-invoices').click();
  await page.waitForLoadState('networkidle');
  check('palette navigates', page.url().includes('/invoices'));
```

- [ ] **Step 4: Run and commit**

Run from `frontend/`: `node scripts/ui-verify.mjs`; expect all PASS.

```bash
git add frontend/src/components/layout/CommandPalette.tsx frontend/src/i18n/locales frontend/scripts/ui-verify.mjs
git commit -m "feat(ui): add command palette navigation"
```

---

### Task 7: StatusBadge restyle

**Files:**
- Modify: `frontend/src/components/ui/Badge.tsx` (exports `StatusBadge`)
- Test: `frontend/scripts/ui-verify.mjs`

**Interfaces:**
- Consumes: tokens (Task 2).
- Produces: `StatusBadge` with token classes and `data-testid="status-badge-<STATUS>"`. PAID uses accent, PENDING amber, OVERDUE destructive.

- [ ] **Step 1: Replace `Badge.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { InvoiceStatus } from '../../types';

interface BadgeProps {
  status: InvoiceStatus;
  className?: string;
}

const styles: Record<InvoiceStatus, { badge: string; dot: string }> = {
  PAID: {
    badge: 'bg-accent text-accent-foreground ring-1 ring-accent/60',
    dot: 'bg-[#5a8f18]',
  },
  PENDING: {
    badge: 'bg-[#FFB300]/25 text-[#8a5b00] ring-1 ring-[#FFB300]/40 dark:bg-[#FFB300]/20 dark:text-[#ffd54f]',
    dot: 'bg-[#FFB300]',
  },
  OVERDUE: {
    badge: 'bg-destructive/15 text-destructive ring-1 ring-destructive/30 dark:bg-destructive/20',
    dot: 'bg-destructive',
  },
};

export function StatusBadge({ status, className }: BadgeProps) {
  const { t } = useTranslation();
  const { badge, dot } = styles[status];
  const labels: Record<InvoiceStatus, string> = {
    PAID: t('common.paid'),
    PENDING: t('common.pending'),
    OVERDUE: t('common.overdue'),
  };
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', badge, className)}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      {labels[status]}
    </span>
  );
}
```

- [ ] **Step 2: Harness check**

```js
  // --- status badge (Task 7) ---
  await goto('/invoices');
  const paidBadge = page.locator('[data-testid="status-badge-PAID"]').first();
  if (await paidBadge.count()) {
    const bg = await paidBadge.evaluate((el) => getComputedStyle(el).backgroundColor);
    check('PAID badge uses lime', bg.includes('139, 195, 74'), bg);
  } else {
    check('PAID badge present on invoices list', false, 'no PAID row found');
  }
```

- [ ] **Step 3: Run and commit**

Run from `frontend/`: `node scripts/ui-verify.mjs`; expect all PASS.

```bash
git add frontend/src/components/ui/Badge.tsx frontend/scripts/ui-verify.mjs
git commit -m "feat(ui): restyle status badges with new tokens"
```

---

### Task 8: Update `test-app.mjs` for the new shell

**Files:**
- Modify: `test-app.mjs`
- Test: `node test-app.mjs` (repo root, both servers running)

**Interfaces:**
- Consumes: test ids from Tasks 5-7.
- Produces: 33 passing checks against the new shell.

- [ ] **Step 1: Replace the `goTo` helper**

```js
  const NAV_ID = {
    '/': 'dashboard',
    '/clients': 'clients',
    '/products': 'products',
    '/invoices': 'invoices',
    '/reports': 'reports',
    '/settings': 'settings',
  };

  const goTo = async (href) => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const id = NAV_ID[href];
    await page.getByTestId(`nav-rail-${id === 'settings' ? 'system' : id === 'products' || id === 'reports' ? 'finance' : 'main'}`).click();
    await page.waitForTimeout(250);
    await page.getByTestId(`nav-item-${id}`).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
  };
```

- [ ] **Step 2: Replace the account/logout selectors**

- `page.locator('aside').waitFor(...)` becomes `page.getByTestId('topbar-account').waitFor(...)`.
- `page.locator(`aside button:has-text("${EMAIL}")`).click()` becomes `page.getByTestId('topbar-account').click()`.
- `page.locator('button:has-text("Logout")').click()` becomes `page.getByTestId('account-logout').click()`.

- [ ] **Step 3: Update the mobile CSS assertion**

The check looks for responsive classes in the page HTML. Replace the class list with the new shell's: `lg:hidden`, `hidden lg:flex`, `overflow-x-auto`.

- [ ] **Step 4: Run the suite**

Run from the repo root: `node test-app.mjs`
Expected: `QA SUMMARY: 33 passed, 0 failed`. Fix any selector that fails by adding the missing test id to the component rather than loosening the selector.

- [ ] **Step 5: Commit**

```bash
git add test-app.mjs
git commit -m "test: update smoke test for rail shell"
```

---

### Task 9: Phase 1 verification and docs

**Files:**
- Modify: `AGENTS.md`
- Test: full command set below

**Interfaces:**
- Consumes: everything above.
- Produces: a verified Phase 1 checkpoint.

- [ ] **Step 1: Run the full verification set**

From `frontend/`: `npx tsc -b`, `npm run lint`, `node scripts/ui-verify.mjs --screens --axe`
From the repo root: `node test-app.mjs`
Expected: tsc 0, lint 0 problems, harness `ALL CHECKS PASS`, E2E 33/33, no serious/critical axe violations.

- [ ] **Step 2: Check screenshots**

Open the screenshot folder printed by the harness. Confirm the shell, tokens, and toasts look right in light mode. Toggle dark mode manually in the app once and confirm the rail, flyout, and backgrounds use the dark tokens.

- [ ] **Step 3: Update `AGENTS.md`**

Add under Commands: `frontend | node scripts/ui-verify.mjs [--screens] [--axe] | Playwright UI checks; both dev servers must be running`. Add under Architecture notes: `Nav config lives in frontend/src/components/layout/nav.ts; nav/actions carry data-testid attributes used by test-app.mjs and scripts/ui-verify.mjs. Keep them when refactoring.`

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: record UI verification harness and test-id convention"
```

---

## Phase 1 exit criteria

- Every page still renders and works with the new shell, tokens, and toast system.
- `npx tsc -b` and `npm run lint` pass with zero problems.
- `node scripts/ui-verify.mjs --screens --axe` passes all checks, including axe with no serious or critical violations.
- `node test-app.mjs` reports 33 passed, 0 failed.
- No file under `backend/` changed.

## Next plans

- Phase 2 (core pages: dashboard, invoices list/new/detail, clients, products) gets its own plan after Phase 1 lands.
- Phase 3 (reports, settings, auth, public invoice, accessibility pass) follows Phase 2.
