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
  await goto('/');
  check('sidebar visible', await page.getByTestId('nav-item-dashboard').isVisible());
  check('section groups rendered', await page.getByTestId('nav-section-finance').isVisible());
  const meUser = await (await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const expectedCompany = meUser.user.companyName?.trim() || 'BillFlow';
  const workspaceText = await page.getByTestId('nav-workspace').innerText();
  check('workspace card shows company name', workspaceText.includes(expectedCompany), workspaceText.replace(/\s+/g, ' ').trim());
  const animationName = await page.getByTestId('nav-item-dashboard').evaluate((el) => getComputedStyle(el).animationName);
  check('nav items animate in', animationName === 'nav-item-in', animationName);
  const ariaCurrent = await page.getByTestId('nav-item-dashboard').getAttribute('aria-current');
  check('active nav item marked aria-current', ariaCurrent === 'page', String(ariaCurrent));
  await shot('dashboard');
  await page.getByTestId('nav-item-reports').click();
  await page.waitForLoadState('networkidle');
  check('sidebar navigates to reports', page.url().endsWith('/reports'));
  await goto('/');
  await page.getByTestId('nav-workspace').focus();
  await page.keyboard.press('Tab');
  check('Tab moves focus into nav items',
    await page.getByTestId('nav-item-dashboard').evaluate((el) => el === document.activeElement));
  await page.setViewportSize({ width: 390, height: 844 });
  await goto('/');
  await page.getByTestId('topbar-menu').click();
  await page.waitForTimeout(400);
  check('mobile nav sheet opens', await page.getByTestId('nav-mobile-invoices').isVisible());
  check('mobile language select visible', await page.getByTestId('nav-mobile-language').isVisible());
  check('mobile currency select visible', await page.getByTestId('nav-mobile-currency').isVisible());
  await page.keyboard.press('Escape');
  await page.getByTestId('nav-mobile-invoices').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  check('escape closes mobile nav', await page.getByTestId('nav-mobile-invoices').isHidden());
  await page.setViewportSize({ width: 1280, height: 800 });

  await goto('/');
  await page.getByTestId('topbar-sidebar-toggle').click();
  await page.waitForTimeout(400);
  const collapsedLabelWidth = await page.getByTestId('nav-workspace').locator('span').last().evaluate((el) => el.getBoundingClientRect().width);
  check('sidebar collapses (labels hidden)', collapsedLabelWidth <= 2, String(collapsedLabelWidth));
  const collapsedWidth = await page.getByTestId('nav-section-main').evaluate((el) => el.parentElement?.getBoundingClientRect().width ?? 0);
  check('collapsed sidebar is narrow', collapsedWidth < 100, String(collapsedWidth));
  const toggleLabel = (await page.getByTestId('topbar-sidebar-toggle').getAttribute('aria-label')) ?? '';
  check('toggle label switches to expand', toggleLabel.includes('Expand'), toggleLabel);
  await page.getByTestId('topbar-sidebar-toggle').click();
  await page.waitForTimeout(400);
  const expandedWidth = await page.getByTestId('nav-section-main').evaluate((el) => el.parentElement?.getBoundingClientRect().width ?? 0);
  check('sidebar expands back', expandedWidth > 200, String(expandedWidth));

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
  // --- status badge (Task 7) ---
  await goto('/invoices');
  await shot('invoices');
  const paidBadge = page.locator('[data-testid="status-badge-PAID"]').first();
  if (await paidBadge.count()) {
    const bg = await paidBadge.evaluate((el) => getComputedStyle(el).backgroundColor);
    check('PAID badge uses lime', bg.includes('139, 195, 74'), bg);
  } else {
    check('PAID badge present on invoices list', false, 'no PAID row found');
  }
  // --- dashboard bento (Task 3) ---
  await goto('/');
  for (const id of ['dashboard-hero-revenue', 'dashboard-stat-outstanding', 'dashboard-stat-paid', 'dashboard-status-bars', 'dashboard-recent']) {
    check(`dashboard bento: ${id}`, await page.getByTestId(id).isVisible());
  }
  await page.getByTestId('dashboard-recent').locator('a[href^="/invoices/"]').first().click();
  await page.waitForLoadState('networkidle');
  check('recent invoice link navigates', page.url().includes('/invoices/'));
  await goto('/');

  // --- invoices ledger (Task 4) ---
  await goto('/invoices');
  check('ledger group header present', (await page.locator('[data-testid^="invoice-group-"]').count()) > 0);
  check('ledger row present', await page.locator('[data-testid^="invoice-row-"]').first().isVisible());

  // Later tasks append their assertions above this line.

  // --- toast adapter (Task 4) ---
  await goto('/settings');
  await shot('settings');
  await page.getByTestId('settings-company-submit').click();
  await page.waitForTimeout(900);
  const toastVisible = await page.locator('[data-sonner-toast]').count();
  check('sonner toast renders on settings save', toastVisible > 0, String(toastVisible));

  // --- final review: mobile nav closes after navigation ---
  await page.setViewportSize({ width: 390, height: 844 });
  await goto('/');
  await page.getByTestId('topbar-menu').click();
  await page.waitForTimeout(300);
  await page.getByTestId('nav-mobile-clients').click();
  await page.waitForLoadState('networkidle');
  await page.getByTestId('nav-mobile-clients').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  check('mobile nav closes after navigating', await page.getByTestId('nav-mobile-clients').isHidden());
  await page.setViewportSize({ width: 1280, height: 800 });

  // --- invoices ledger interaction (Task 4 fix round) ---
  await goto('/invoices');
  const firstLedgerRow = page.locator('[data-testid^="invoice-row-"]').first();
  await firstLedgerRow.locator('input[type=checkbox]').click();
  await page.waitForTimeout(200);
  check('bulk bar appears on selection', await page.getByTestId('bulk-bar').isVisible());
  await page.getByTestId('invoice-select-page').click();
  await page.waitForTimeout(200);
  check('select-all selects the page', (await page.locator('[data-testid^="invoice-select-"]:not([data-testid="invoice-select-page"]):checked').count()) > 1);
  await page.keyboard.press('Escape');
  await firstLedgerRow.getByRole('link').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle');
  check('keyboard opens invoice detail', /\/invoices\/\d+/.test(page.url()));
  await goto('/invoices');
  await page.locator('[data-testid^="invoice-delete-"]').first().click();
  await page.waitForTimeout(300);
  check('row delete opens the confirm modal', await page.getByTestId('invoice-delete-confirm').isVisible());

  await goto('/invoices?sort=total_asc');
  check('flat ledger for amount sort', (await page.locator('[data-testid^="invoice-group-"]').count()) === 0);
  const rowIds = await page.locator('[data-testid^="invoice-row-"]').evaluateAll((els) =>
    els.map((el) => Number(el.getAttribute('data-testid').replace('invoice-row-', ''))));
  const apiTotals = await page.evaluate(async () => {
    const res = await fetch('/api/invoices', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    const body = await res.json();
    return Object.fromEntries(body.invoices.map((i) => [i.id, parseFloat(i.total)]));
  });
  const monotonic = rowIds.every((id, idx) => idx === 0 || apiTotals[rowIds[idx - 1]] <= apiTotals[id]);
  check('amount sort is monotonic on screen', monotonic);
  await goto('/invoices');

  if (WANT_AXE) {
    await goto('/');
    await page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.10.2/axe.min.js' });
    const result = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    }));
    const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check('axe: no serious/critical violations on dashboard', serious.length === 0,
      serious.map((v) => v.id).join(', '));

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(300);
    const darkResult = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    }));
    const darkSerious = darkResult.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check('axe dark: no serious/critical violations on dashboard', darkSerious.length === 0,
      darkSerious.map((v) => v.id).join(', '));
    await shot('dashboard-dark');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(400);
    const paletteResult = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    }));
    const paletteSerious = paletteResult.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check('axe: no serious/critical violations in command palette', paletteSerious.length === 0,
      paletteSerious.map((v) => v.id).join(', '));
    await page.keyboard.press('Escape');

    await goto('/invoices');
    await page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.10.2/axe.min.js' });
    const invResult = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    }));
    const invSerious = invResult.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check('axe: no serious/critical violations on invoices', invSerious.length === 0, invSerious.map((v) => v.id).join(', '));

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(300);
    await shot('invoices-dark');
    const invDark = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    }));
    const invDarkSerious = invDark.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check('axe dark: no serious/critical violations on invoices', invDarkSerious.length === 0, invDarkSerious.map((v) => v.id).join(', '));
    await page.evaluate(() => document.documentElement.classList.remove('dark'));

    const detailRow = await page.getAttribute('[data-testid^="invoice-row-"]', 'data-testid');
    const detailId = detailRow ? detailRow.replace('invoice-row-', '') : null;

    const restyled = [
      ['clients', '/clients', true],
      ['products', '/products', false],
      ['new-invoice', '/invoices/new', false],
      ['invoice-detail', detailId ? `/invoices/${detailId}` : null, false],
      ['reports', '/reports', true],
      ['settings', '/settings', false],
    ];
    for (const [name, path, dark] of restyled) {
      if (!path) continue;
      await goto(path);
      await page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.10.2/axe.min.js' });
      const r = await page.evaluate(async () => window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      }));
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      check(`axe: no serious/critical violations on ${name}`, bad.length === 0, bad.map((v) => v.id).join(', '));
      await shot(name);
      if (dark) {
        await page.evaluate(() => document.documentElement.classList.add('dark'));
        await page.waitForTimeout(300);
        await shot(`${name}-dark`);
        const rd = await page.evaluate(async () => window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        }));
        const badDark = rd.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        check(`axe dark: no serious/critical violations on ${name}`, badDark.length === 0, badDark.map((v) => v.id).join(', '));
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
      } else {
        await shot(name);
      }
    }
  }

  if (shots) console.log(`\nScreenshots: ${shots}`);
  await browser.close();

  console.log(`\n${failures.length === 0 ? 'ALL CHECKS PASS' : `${failures.length} CHECK(S) FAILED`}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
