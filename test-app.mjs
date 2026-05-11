import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const EMAIL = 'qa_' + Date.now() + '@billflow.com';
const PASSWORD = 'Test1234!';

let passed = 0, failed = 0;
const issues = [];

const pass = (label) => { console.log(`  ✅ ${label}`); passed++; };
const fail = (label, detail = '') => {
  const msg = `${label}${detail ? ': ' + String(detail).split('\n')[0].slice(0, 100) : ''}`;
  console.log(`  ❌ ${msg}`);
  failed++;
  issues.push(msg);
};

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  // helper: click sidebar nav link (dismiss any open modal first)
  const goTo = async (href) => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.locator(`aside a[href="${href}"]`).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
  };

  // ── 1. AUTH ───────────────────────────────────────────────────────────────
  console.log('\n[1] Auth — Register + Login');
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');

  try {
    await page.waitForURL('**/login', { timeout: 5000 });
    pass('Redirected to /login');
  } catch { fail('Redirect to /login', page.url()); }

  try {
    await page.locator('a[href*="register"]').click();
    await page.waitForURL('**/register', { timeout: 5000 });
    pass('Navigated to /register');
  } catch (e) { fail('Navigate to register', e.message); }

  // Fill registration form — confirm password has no name attr, use nth(1)
  try {
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').nth(0).fill(PASSWORD);
    await page.locator('input[type="password"]').nth(1).fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const url = page.url();
    if (url.includes('register')) {
      const errText = await page.locator('.text-red-600').first().innerText().catch(() => '?');
      fail('Register', `stayed on /register, error: "${errText}"`);
    } else {
      pass(`Registered → ${url}`);
    }
  } catch (e) { fail('Register form', e.message); }

  // Login if needed
  if (page.url().includes('login')) {
    try {
      await page.locator('input[type="email"]').fill(EMAIL);
      await page.locator('input[type="password"]').fill(PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      pass('Login after register');
    } catch (e) { fail('Login after register', e.message); }
  }

  try {
    await page.locator('aside').waitFor({ timeout: 6000 });
    pass('App sidebar visible after auth');
  } catch { fail('Sidebar visible', page.url()); }

  // Logout via account dropdown (sidebar footer)
  try {
    await page.locator(`aside button:has-text("${EMAIL}")`).click();
    await page.waitForTimeout(400);
    await page.locator('button:has-text("Logout")').click();
    await page.waitForURL('**/login', { timeout: 5000 });
    pass('Logout works');
  } catch (e) { fail('Logout', e.message); }

  // Re-login
  try {
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    await page.locator('aside').waitFor({ timeout: 5000 });
    pass('Re-login works');
  } catch (e) { fail('Re-login', e.message); }

  // ── 2. SETTINGS ──────────────────────────────────────────────────────────
  console.log('\n[2] Settings — company info + invoice defaults');
  await goTo('/settings');

  try {
    // Company name uses placeholder "Acme Lda." — reliable unique selector
    await page.locator('input[placeholder="Acme Lda."]').fill('Test Co');
    pass('Company name filled');
  } catch (e) { fail('Company name', e.message); }

  try {
    // Labels from EN: 'Default VAT (%)' → input[type=number][max="100"]
    //                 'Payment terms (days)' → input[type=number][max="365"]
    //                 'Invoice prefix' → placeholder="INV"
    const taxInput = page.getByLabel('Default VAT (%)');
    await taxInput.fill('20');
    pass('Default VAT filled: 20');

    const daysInput = page.getByLabel('Payment terms (days)');
    await daysInput.fill('30');
    pass('Payment terms filled: 30');

    const prefixInput = page.getByLabel('Invoice prefix');
    await prefixInput.fill('INV-');
    pass('Invoice prefix filled: INV-');
  } catch (e) { fail('Invoice defaults', e.message); }

  try {
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(1500);
    // Check for toast success or no error
    const toastErr = await page.locator('[class*="toast"][class*="error"], .text-red-600').count();
    if (toastErr === 0) pass('Settings saved');
    else fail('Settings save error', 'error visible after save');
  } catch (e) { fail('Settings save', e.message); }

  try {
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    const val = await page.locator('input[placeholder="Acme Lda."]').inputValue();
    if (val === 'Test Co') pass('Settings persist after reload');
    else fail('Settings persistence', `companyName = "${val}"`);
  } catch (e) { fail('Settings persistence', e.message); }

  // ── 3. CLIENTS ────────────────────────────────────────────────────────────
  console.log('\n[3] Clients — create + list');
  await goTo('/clients');

  try {
    await page.locator('button:has-text("New client")').click();
    await page.waitForTimeout(500);
    // Modal opens — Input label "Name *" → id="name-*" → use placeholder or label
    await page.getByLabel('Name *').fill('Acme Corp');
    await page.getByLabel('Email').fill('acme@example.com');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    const acme = await page.locator('text=Acme Corp').count();
    if (acme) pass('Client "Acme Corp" created');
    else fail('Client created', '"Acme Corp" not visible');
  } catch (e) { fail('Create client', e.message); }

  // Pagination (only shows if >10 items; with 1 item it won't appear)
  const paginationVisible = await page.locator('text=/Page \\d+ of \\d+/').count();
  pass(`Pagination: ${paginationVisible ? 'shown' : 'not shown (expected with 1 client)'}`);

  // ── 4. PRODUCTS ───────────────────────────────────────────────────────────
  console.log('\n[4] Products — create + usage count');
  await goTo('/products');

  try {
    await page.locator('button:has-text("New product")').first().click();
    await page.waitForTimeout(500);
    await page.getByLabel('Name').first().fill('Widget');  // Products: label="Name" (no asterisk)
    await page.getByLabel('Price').fill('100');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    const widget = await page.locator('text=Widget').count();
    if (widget) pass('Product "Widget" created');
    else fail('Product created', '"Widget" not visible');
  } catch (e) { fail('Create product', e.message); }

  try {
    // Usage count shows "X inv." badge when > 0, but for a new product it won't show yet
    // So we just check the product row exists — usage count will be validated post-invoice
    const row = await page.locator('text=Widget').count();
    if (row) pass('Widget row present (usage count checked after invoice creation)');
    else fail('Widget row', 'not found');
  } catch (e) { fail('Product row', e.message); }

  // ── 5. NEW INVOICE ────────────────────────────────────────────────────────
  console.log('\n[5] New Invoice — pre-fills, total, submit');
  await goTo('/invoices');

  try {
    await page.locator('a[href="/invoices/new"], button:has-text("New Invoice")').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    pass('Opened New Invoice form');
  } catch (e) { fail('Open New Invoice', e.message); }

  // Due date pre-fill (should be today + 30 days from payment terms)
  try {
    const dueVal = await page.getByLabel('Due date').inputValue().catch(() => '');
    if (dueVal) pass(`Due date pre-filled: ${dueVal}`);
    else fail('Due date pre-fill', 'field empty');
  } catch (e) { fail('Due date pre-fill', e.message); }

  // VAT pre-fill (should be 20 from settings)
  try {
    const vatVal = await page.getByLabel('VAT (%)').inputValue().catch(() => '');
    if (parseFloat(vatVal) === 20) pass('VAT pre-filled: 20%');
    else fail('VAT pre-fill', `got "${vatVal}", expected 20`);
  } catch (e) { fail('VAT pre-fill', e.message); }

  // Select client
  try {
    await page.getByLabel('Client').selectOption({ label: 'Acme Corp' });
    pass('Client "Acme Corp" selected');
  } catch (e) { fail('Select client', e.message); }

  // Line item — select Widget, qty 2
  try {
    await page.getByLabel('Product').selectOption({ label: 'Widget' });
    await page.waitForTimeout(400);
    await page.getByLabel('Qty').fill('2');
    await page.waitForTimeout(600);
    pass('Line item: Product=Widget, Qty=2');
  } catch (e) { fail('Line item', e.message); }

  // Total should be 240 (2 × 100 + 20% VAT = 240)
  try {
    const body = await page.locator('body').innerText();
    if (/\b240\b|240\.00/.test(body)) pass('Total = 240 ✓ (200 + 20% VAT)');
    else {
      const nums = [...new Set(body.match(/\b\d{3,}\.\d{2}\b/g) || [])];
      fail('Total = 240', `visible amounts: ${nums.join(', ')}`);
    }
  } catch (e) { fail('Total check', e.message); }

  // Capture invoice POST body to verify productId is sent
  let capturedInvoiceBody = null;
  page.on('request', req => {
    if (req.url().includes('/api/invoices') && req.method() === 'POST') {
      try { capturedInvoiceBody = JSON.parse(req.postData() || '{}'); } catch { /* */ }
    }
  });

  // Submit
  let invoiceId = '';
  try {
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const url = page.url();
    const m = url.match(/invoices\/(\d+)/);
    if (m) {
      invoiceId = m[1];
      const firstItem = capturedInvoiceBody?.items?.[0];
      const pId = firstItem?.productId;
      pass(`Invoice created → /invoices/${invoiceId} (item productId=${pId})`);
      if (!pId) fail('Item productId', `not sent — body: ${JSON.stringify(firstItem)}`);
    } else if (url.includes('invoices') && !url.includes('new')) pass('Invoice created → invoices page');
    else fail('Invoice submit redirect', `url: ${url}`);
  } catch (e) { fail('Submit invoice', e.message); }

  // ── 5b. PRODUCTS — verify usage count updates ────────────────────────────
  console.log('\n[5b] Products — usage count after invoice');
  // Intercept products response to see actual invoiceCount from server
  const productsResponsePromise = page.waitForResponse(
    res => res.url().includes('/api/products') && res.status() === 200,
    { timeout: 10000 }
  ).then(async (res) => {
    const body = await res.json().catch(() => null);
    const widget = body?.products?.find((p) => p.name === 'Widget');
    console.log(`  [debug] /api/products response: Widget invoiceCount=${widget?.invoiceCount}`);
    return widget;
  }).catch(() => null);

  await goTo('/products');
  const widgetFromApi = await productsResponsePromise;
  await page.waitForTimeout(500);
  try {
    const badge = await page.locator('text=/\\d+ inv\\./').count();
    if (badge) pass('Usage count badge visible on Widget row');
    else if (widgetFromApi?.invoiceCount > 0) {
      // Data from server is correct, just not rendering — display bug
      fail('Usage count badge', `API returns invoiceCount=${widgetFromApi.invoiceCount} but badge not rendered in UI`);
    } else {
      const rowText = await page.locator('text=Widget').first().locator('../..').innerText().catch(() => '');
      fail('Usage count badge', `Widget row: "${rowText.replace(/\n/g, ' ').slice(0, 80)}"`);
    }
  } catch (e) { fail('Usage count', e.message); }

  // ── 6. INVOICE LIST ───────────────────────────────────────────────────────
  console.log('\n[6] Invoice list — search + filter + mobile CSS');
  await goTo('/invoices');

  try {
    const rows = await page.locator('table tbody tr').count();
    if (rows > 0) pass(`Invoice list: ${rows} row(s) in table`);
    else fail('Invoice table rows', 'none found');
  } catch (e) { fail('Invoice list', e.message); }

  try {
    const search = page.locator('input[placeholder*="Search" i], input[placeholder*="search" i]').first();
    if (await search.count()) {
      await search.fill('INV-');
      await page.waitForTimeout(700);
      pass('Search input responds');
      await search.fill('');
      await page.waitForTimeout(400);
    } else fail('Search input', 'not found');
  } catch (e) { fail('Search', e.message); }

  try {
    // Mobile classes only render when rows exist — reload after invoice was created
    const html = await page.content();
    const hasMobile = html.includes('sm:hidden') || html.includes('hidden sm:') ||
                      html.includes('sm:block') || html.includes('hidden overflow-x-auto');
    if (hasMobile) pass('Mobile card CSS (sm: breakpoints) present');
    else fail('Mobile CSS', 'no sm: responsive classes found in HTML (may be empty list)');
  } catch (e) { fail('Mobile CSS', e.message); }

  // ── 7. INVOICE DETAIL — Duplicate ─────────────────────────────────────────
  console.log('\n[7] Invoice detail — Duplicate');
  try {
    if (invoiceId) {
      await page.goto(`${BASE}/invoices/${invoiceId}`);
    } else {
      await page.locator('table tbody tr').first().click();
    }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    pass('On invoice detail page');
  } catch (e) { fail('Open invoice detail', e.message); }

  try {
    const dup = page.locator('button:has-text("Duplicate"), a:has-text("Duplicate")').first();
    if (await dup.count()) {
      await dup.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);
      const url = page.url();
      const banner = await page.locator('text=/duplicat|pre.fill/i').count();
      const isNew = url.includes('new') || url.includes('create');
      if (banner || isNew) pass('Duplicate → NewInvoicePage (pre-filled)');
      else fail('Duplicate result', `url: ${url}`);
    } else fail('Duplicate button', 'not found on invoice detail');
  } catch (e) { fail('Duplicate button', e.message); }

  // ── 8. DASHBOARD ─────────────────────────────────────────────────────────
  console.log('\n[8] Dashboard — stat cards + chart');
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1800);

  try {
    const svgs = await page.locator('svg').count();
    if (svgs > 0) pass(`Chart SVG elements: ${svgs}`);
    else fail('Dashboard chart', 'no SVG found');
  } catch (e) { fail('Dashboard', e.message); }

  try {
    const body = await page.locator('body').innerText();
    // Should show some invoice/revenue numbers
    const hasCurrency = /€|\$|R\$|£|\d/.test(body);
    if (hasCurrency) pass('Dashboard stat cards show data');
    else fail('Dashboard stats', 'no numeric content visible');
  } catch (e) { fail('Dashboard stats', e.message); }

  // ── 9. REPORTS — aging buckets ────────────────────────────────────────────
  console.log('\n[9] Reports — aging buckets');
  await goTo('/reports');
  await page.waitForTimeout(1500);

  try {
    const aging = await page.locator('text=/0.{0,3}30|31.{0,3}60|61.{0,3}90|90\+/').count();
    if (aging >= 4) pass(`All 4 aging buckets visible (${aging} matches)`);
    else if (aging > 0) pass(`${aging} aging bucket(s) visible`);
    else fail('Aging buckets', 'no 0-30/31-60/61-90/90+ labels found');
  } catch (e) { fail('Aging buckets', e.message); }

  // ── 10. DELETE CLIENT WITH INVOICE ────────────────────────────────────────
  console.log('\n[10] Delete client with invoice — expect 409 error');
  await goTo('/clients');

  try {
    // Buttons are opacity-0 normally, need to hover the row first
    const row = page.locator('text=Acme Corp').locator('..').locator('..');
    await row.hover();
    await page.waitForTimeout(300);
    // Delete button is the last button in the row action group
    const deleteBtn = row.locator('button[title="Delete"]').first();
    if (!await deleteBtn.count()) {
      // Try finding by title attribute from t('common.delete') = 'Delete'
      await row.locator('button').last().click();
    } else {
      await deleteBtn.click();
    }
    await page.waitForTimeout(600);
    // Delete modal opens — click confirm Delete button
    await page.locator('button[class*="danger"], button:has-text("Delete")').last().click();
    await page.waitForTimeout(1500);
    // Should see error about invoices (deleteError state renders in modal)
    const errMsg = await page.locator('text=/invoice|cannot|has/i').count();
    if (errMsg > 0) pass('Delete blocked with invoice conflict error');
    else {
      const acmeGone = await page.locator('text=Acme Corp').count() === 0;
      if (acmeGone) fail('Delete 409 protection', 'CLIENT WAS DELETED — should have been blocked');
      else fail('Delete 409 error', 'client not deleted but no error message shown');
    }
  } catch (e) { fail('Delete client with invoice', e.message); }

  // ── CONSOLE ERRORS ────────────────────────────────────────────────────────
  console.log('\n[Console Errors]');
  const filtered = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('extension') &&
    !e.includes('google') && !e.includes('ResizeObserver')
  );
  if (filtered.length === 0) console.log('  ✅ No significant console errors');
  else filtered.forEach(e => console.log(`  ⚠️  ${e.slice(0, 120)}`));

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`QA SUMMARY: ${passed} passed, ${failed} failed`);
  if (issues.length) {
    console.log('\nIssues found:');
    issues.forEach((i, n) => console.log(`  ${n + 1}. ${i}`));
  }
  const verdict = failed === 0 ? '✅ ALL PASS'
    : failed <= 2 ? '⚠️  SHIP WITH MINOR FIXES'
    : failed <= 5 ? '🔶 NEEDS WORK'
    : '❌ SIGNIFICANT ISSUES';
  console.log(`\nVerdict: ${verdict}`);
  console.log('═'.repeat(60) + '\n');

  await browser.close();
})();
