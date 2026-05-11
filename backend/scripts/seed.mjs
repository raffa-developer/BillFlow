/**
 * Seed script — populates the first user's account with realistic data.
 * Usage: npm run db:seed
 * Safe to re-run: clears only the seeded user's data first.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── helpers ────────────────────────────────────────────────────────────────

const rnd = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── data ───────────────────────────────────────────────────────────────────

const CLIENTS = [
  { name: 'Acme Corporation',       email: 'billing@acme.com',         phone: '+1 555-0101', address: '1 Roadrunner Ave, Phoenix, AZ 85001' },
  { name: 'Globex Industries',      email: 'accounts@globex.com',      phone: '+1 555-0102', address: '742 Evergreen Terrace, Springfield, IL' },
  { name: 'Initech Solutions',      email: 'finance@initech.io',       phone: '+1 555-0103', address: '15 Corporate Park, Austin, TX 78701' },
  { name: 'Umbrella Corp',          email: 'ap@umbrella.com',          phone: '+44 20 7946 0100', address: '4 Arklay Drive, London EC1A 1BB' },
  { name: 'Stark Industries',       email: 'billing@stark.tech',       phone: '+1 555-0105', address: '10880 Malibu Point, Malibu, CA 90265' },
  { name: 'Wayne Enterprises',      email: 'accounts@wayne.com',       phone: '+1 555-0106', address: '1007 Mountain Drive, Gotham, NJ 07001' },
  { name: 'Oscorp Technologies',    email: 'finance@oscorp.com',       phone: '+1 555-0107', address: '500 OsCorp Tower, New York, NY 10001' },
  { name: 'Veridian Dynamics',      email: 'billing@veridian.com',     phone: '+1 555-0108', address: '3300 Research Blvd, San Jose, CA 95101' },
  { name: 'Massive Dynamic',        email: 'ap@massivedynamic.com',    phone: '+1 555-0109', address: '655 Fringe Blvd, Boston, MA 02101' },
  { name: 'Bluth Company',          email: 'lucille@bluthco.com',      phone: '+1 555-0110', address: '1 Model Home, Newport Beach, CA 92660' },
  { name: 'Pied Piper',             email: 'billing@piedpiper.com',    phone: '+1 555-0111', address: '5230 Newell Rd, Palo Alto, CA 94303' },
  { name: 'Hooli Inc.',             email: 'ap@hooli.com',             phone: '+1 555-0112', address: '1 Hooli Campus, Mountain View, CA 94043' },
  { name: 'Dunder Mifflin',         email: 'accounting@dm.com',        phone: '+1 570-555-0113', address: '1725 Slough Ave, Scranton, PA 18501' },
  { name: 'Vandelay Industries',    email: 'art@vandelay.com',         phone: '+1 555-0114', address: '129 W 81st St, New York, NY 10024' },
  { name: 'Soylent Corp',           email: 'finance@soylent.com',      phone: '+1 555-0115', address: '2099 Future Blvd, San Francisco, CA 94105' },
  { name: 'Tyrell Corporation',     email: 'billing@tyrell.com',       phone: '+1 555-0116', address: '2019 Blade Runner Blvd, Los Angeles, CA' },
  { name: 'Nakatomi Trading',       email: 'ap@nakatomi.co.jp',        phone: '+81 3-5555-0117', address: '2121 Avenue of the Stars, LA, CA 90067' },
  { name: 'Cyberdyne Systems',      email: 'finance@cyberdyne.com',    phone: '+1 555-0118', address: '18144 El Camino Real, Sunnyvale, CA 94087' },
  { name: 'Rekall Inc.',            email: 'accounts@rekall.com',      phone: '+1 555-0119', address: '1 Mars Colony Dr, Houston, TX 77001' },
  { name: 'Sirius Cybernetics',     email: 'billing@siriuscyb.com',    phone: '+44 1865 555-0120', address: '42 Milliways Rd, Oxford OX1 1PT' },
  { name: 'Fernando Alves',         email: 'fernando.alves@gmail.com', phone: '+351 912 345 678', address: 'Rua das Flores 12, Lisboa 1200-195' },
  { name: 'Sofia Martins',          email: 'sofia.m@outlook.com',      phone: '+351 963 456 789', address: 'Av. da Liberdade 80, Porto 4000-320' },
  { name: 'Lucas Rodrigues',        email: 'lucas.r@yahoo.com',        phone: '+351 934 567 890', address: 'Rua do Comércio 5, Braga 4700-220' },
  { name: 'Beatriz Costa',          email: 'beatriz.c@proton.me',      phone: '+351 915 678 901', address: 'Praça do Giraldo 3, Évora 7000-506' },
  { name: 'João Ferreira',          email: 'joao.f@live.com',          phone: '+351 967 789 012', address: 'Rua de Santa Catarina 120, Porto 4000-450' },
];

const PRODUCTS = [
  { name: 'Web Development (hourly)',    price: 85.00,  description: 'Full-stack web development services, billed per hour' },
  { name: 'UI/UX Design (hourly)',       price: 75.00,  description: 'User interface and experience design, billed per hour' },
  { name: 'Backend API Development',     price: 1200.00, description: 'REST or GraphQL API design and implementation' },
  { name: 'Mobile App Development',      price: 3500.00, description: 'iOS and Android app development per sprint' },
  { name: 'SEO Audit & Strategy',        price: 650.00, description: 'Technical SEO audit with actionable recommendations' },
  { name: 'Monthly Hosting (Basic)',     price: 29.99,  description: 'Shared hosting plan — 10 GB storage, SSL included' },
  { name: 'Monthly Hosting (Pro)',       price: 79.99,  description: 'VPS hosting — 50 GB NVMe, 4 vCPU, daily backups' },
  { name: 'Domain Registration (1yr)',   price: 12.99,  description: 'Domain name registration including DNS management' },
  { name: 'Security Audit',             price: 950.00, description: 'Vulnerability assessment and penetration testing report' },
  { name: 'Consulting (hourly)',         price: 120.00, description: 'Technical consulting and architecture advisory' },
  { name: 'Content Writing (per page)', price: 95.00,  description: 'SEO-optimised content writing for websites and blogs' },
  { name: 'Email Marketing Setup',      price: 450.00, description: 'Campaign setup, templates, and automation flows' },
  { name: 'Logo & Brand Identity',      price: 800.00, description: 'Logo design, colour palette, typography, and brand guide' },
  { name: 'WordPress Development',      price: 1100.00, description: 'Custom WordPress theme and plugin development' },
  { name: 'Database Optimisation',      price: 550.00, description: 'Query tuning, indexing, and schema review' },
  { name: 'CI/CD Pipeline Setup',       price: 700.00, description: 'GitHub Actions / GitLab CI pipeline configuration' },
  { name: 'Analytics Integration',      price: 320.00, description: 'GA4, Tag Manager, and custom event tracking setup' },
  { name: 'Tech Support (monthly)',     price: 199.00, description: 'Priority support retainer, up to 5 hours per month' },
  { name: 'E-commerce Integration',     price: 1800.00, description: 'Payment gateway, cart, and checkout implementation' },
  { name: 'Performance Optimisation',   price: 480.00, description: 'Core Web Vitals improvement and bundle size reduction' },
];

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();

  try {
    // Seed every existing user (or create a demo one if none exist)
    let { rows: users } = await client.query(`SELECT id, email FROM "User" ORDER BY id`);

    if (users.length === 0) {
      const hash = await bcrypt.hash('Demo1234!', 10);
      const { rows: [newUser] } = await client.query(
        `INSERT INTO "User" (email, "passwordHash", "companyName", "companyAddress", "companyVat", "companyEmail", currency, "baseCurrency")
         VALUES ($1, $2, $3, $4, $5, $6, 'EUR', 'EUR')
         RETURNING id, email`,
        ['demo@billflow.com', hash, 'BillFlow Demo', 'Rua Exemplo 1, Lisboa 1000-001', 'PT123456789', 'demo@billflow.com']
      );
      users = [newUser];
      console.log('Created demo user: demo@billflow.com / Demo1234!');
    }

    for (const user of users) {
      await seedUser(client, user.id);
      console.log(`✓ Seeded user ${user.email} (id=${user.id})`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function seedUser(client, userId) {
    console.log(`Seeding for user id=${userId}`);

    // Clear existing seeded data
    await client.query(`DELETE FROM "Invoice"  WHERE "userId" = $1`, [userId]);
    await client.query(`DELETE FROM "Client"   WHERE "userId" = $1`, [userId]);
    await client.query(`DELETE FROM "Product"  WHERE "userId" = $1`, [userId]);
    await client.query(`UPDATE "User" SET "invoiceCounter" = 0 WHERE id = $1`, [userId]);

    // ── Insert clients
    const clientIds = [];
    for (const c of CLIENTS) {
      const { rows: [row] } = await client.query(
        `INSERT INTO "Client" ("userId", name, email, phone, address) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [userId, c.name, c.email, c.phone, c.address]
      );
      clientIds.push(row.id);
    }
    console.log(`Inserted ${clientIds.length} clients`);

    // ── Insert products
    const productIds = [];
    for (const p of PRODUCTS) {
      const { rows: [row] } = await client.query(
        `INSERT INTO "Product" ("userId", name, price, "basePrice", description) VALUES ($1,$2,$3,$3,$4) RETURNING id`,
        [userId, p.name, p.price, p.description]
      );
      productIds.push({ id: row.id, price: p.price });
    }
    console.log(`Inserted ${productIds.length} products`);

    // ── Invoice helpers
    const STATUSES = ['PAID', 'PAID', 'PAID', 'PENDING', 'PENDING', 'OVERDUE'];
    const DISCOUNT_TYPES = ['NONE', 'NONE', 'NONE', 'PERCENT', 'FIXED'];

    let counter = 0;

    async function createInvoice(issueOffset, dueOffset, statusHint) {
      counter++;
      const number = `INV-${String(counter).padStart(4, '0')}`;
      const dateIssued = daysAgo(issueOffset);
      const dueDate = daysAgo(dueOffset);
      const status = statusHint ?? pick(STATUSES);
      const clientId = pick(clientIds);

      // 1–4 line items
      const itemCount = Math.floor(rnd(1, 5));
      const items = Array.from({ length: itemCount }, () => {
        const prod = pick(productIds);
        const quantity = Math.floor(rnd(1, 8));
        const price = round2(prod.price * rnd(0.85, 1.15));
        return { productId: prod.id, price, quantity };
      });

      const subtotal = round2(items.reduce((s, i) => s + i.price * i.quantity, 0));
      const discountType = pick(DISCOUNT_TYPES);
      const discountValue = discountType === 'PERCENT' ? pick([5, 10, 15, 20])
        : discountType === 'FIXED' ? round2(rnd(20, 150))
        : 0;
      const discountAmount = discountType === 'PERCENT' ? round2(subtotal * discountValue / 100)
        : discountType === 'FIXED' ? Math.min(discountValue, subtotal)
        : 0;
      const taxRate = pick([0, 0, 23, 23, 23, 13, 6]);
      const afterDiscount = Math.max(0, subtotal - discountAmount);
      const taxAmount = round2(afterDiscount * taxRate / 100);
      const total = round2(afterDiscount + taxAmount);

      const { rows: [inv] } = await client.query(
        `INSERT INTO "Invoice"
           ("userId","clientId",number,"dateIssued","dueDate",
            subtotal,"baseSubtotal",
            "discountType","discountValue","baseDiscountValue",
            "taxRate","taxAmount","baseTaxAmount",
            total,"baseTotal",status)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7::\"DiscountType\",$8,$8,$9,$10,$10,$11,$11,$12::\"InvoiceStatus\")
         RETURNING id`,
        [userId, clientId, number, dateIssued, dueDate,
         subtotal, discountType, discountValue, taxRate, taxAmount, total, status]
      );

      for (const item of items) {
        await client.query(
          `INSERT INTO "InvoiceItem" ("invoiceId","productId",description,quantity,price,"basePrice")
           VALUES ($1,$2,$3,$4,$5,$5)`,
          [inv.id, item.productId, PRODUCTS.find(p => productIds.find(x => x.id === item.productId && x.price === p.price)) ? '' : 'Service', item.quantity, item.price]
        );
      }

      await client.query(`UPDATE "User" SET "invoiceCounter" = $1 WHERE id = $2`, [counter, userId]);
    }

    // ── Generate invoices spread over the last 12 months
    // Past year — mostly PAID
    for (let i = 0; i < 30; i++) {
      const offset = Math.floor(rnd(60, 365));
      await createInvoice(offset, offset - 30, 'PAID');
    }
    // Past 2 months — mix
    for (let i = 0; i < 25; i++) {
      const offset = Math.floor(rnd(15, 60));
      await createInvoice(offset, offset - 30, pick(['PAID', 'PAID', 'PENDING', 'OVERDUE']));
    }
    // Recent (last 2 weeks) — mostly pending
    for (let i = 0; i < 20; i++) {
      const offset = Math.floor(rnd(0, 14));
      await createInvoice(offset, offset + 30, pick(['PENDING', 'PENDING', 'PAID']));
    }
    // Overdue
    for (let i = 0; i < 10; i++) {
      const offset = Math.floor(rnd(45, 120));
      await createInvoice(offset, offset - 60, 'OVERDUE');
    }

    console.log(`  Inserted ${counter} invoices`);
}

main().catch(err => { console.error(err); process.exit(1); });
