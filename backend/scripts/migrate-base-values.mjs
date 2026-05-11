import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // User: store base currency (the currency values are stored in)
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "baseCurrency" TEXT NOT NULL DEFAULT 'EUR'`);
    // For existing users, base = their current currency (values are already in that currency)
    await client.query(`UPDATE "User" SET "baseCurrency" = "currency"`);

    // Product: base price at full precision
    await client.query(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "basePrice" DECIMAL(15,6)`);
    await client.query(`UPDATE "Product" SET "basePrice" = price WHERE "basePrice" IS NULL`);
    await client.query(`ALTER TABLE "Product" ALTER COLUMN "basePrice" SET NOT NULL`);

    // InvoiceItem: base price at full precision
    await client.query(`ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "basePrice" DECIMAL(15,6)`);
    await client.query(`UPDATE "InvoiceItem" SET "basePrice" = price WHERE "basePrice" IS NULL`);
    await client.query(`ALTER TABLE "InvoiceItem" ALTER COLUMN "basePrice" SET NOT NULL`);

    // Invoice: base monetary columns at full precision
    await client.query(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "baseSubtotal"     DECIMAL(15,6)`);
    await client.query(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "baseDiscountValue" DECIMAL(15,6)`);
    await client.query(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "baseTaxAmount"    DECIMAL(15,6)`);
    await client.query(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "baseTotal"        DECIMAL(15,6)`);
    await client.query(`
      UPDATE "Invoice" SET
        "baseSubtotal"      = subtotal,
        "baseDiscountValue" = "discountValue",
        "baseTaxAmount"     = "taxAmount",
        "baseTotal"         = total
      WHERE "baseTotal" IS NULL
    `);
    await client.query(`ALTER TABLE "Invoice" ALTER COLUMN "baseSubtotal"     SET NOT NULL`);
    await client.query(`ALTER TABLE "Invoice" ALTER COLUMN "baseDiscountValue" SET NOT NULL`);
    await client.query(`ALTER TABLE "Invoice" ALTER COLUMN "baseTaxAmount"    SET NOT NULL`);
    await client.query(`ALTER TABLE "Invoice" ALTER COLUMN "baseTotal"        SET NOT NULL`);

    await client.query('COMMIT');
    console.log('Migration complete: added base value columns');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
