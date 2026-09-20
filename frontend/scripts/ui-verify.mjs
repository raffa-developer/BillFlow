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

  await goto('/');
  await page.getByTestId('nav-rail-finance').click();
  await page.waitForTimeout(200);
  check('pinned flyout visible before outside click', await page.getByTestId('nav-flyout').isVisible());
  await page.locator('main').click();
  await page.waitForTimeout(300);
  check('outside click unpins flyout', (await page.getByTestId('nav-flyout').count()) === 0);

  await goto('/');
  await page.getByTestId('nav-rail-finance').click();
  await page.waitForTimeout(200);
  check('flyout visible before escape', await page.getByTestId('nav-flyout').isVisible());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('escape closes flyout', (await page.getByTestId('nav-flyout').count()) === 0);

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
  // --- badge checks (Task 7) ---
  // Later tasks append their assertions above this line.

  // --- toast adapter (Task 4) ---
  await goto('/settings');
  await page.getByTestId('settings-company-submit').click();
  await page.waitForTimeout(900);
  const toastVisible = await page.locator('[data-sonner-toast]').count();
  check('sonner toast renders on settings save', toastVisible > 0, String(toastVisible));

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
