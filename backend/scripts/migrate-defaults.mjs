import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "defaultTaxRate"    DECIMAL(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "defaultPaymentDays" INTEGER      NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS "invoicePrefix"     TEXT         NOT NULL DEFAULT 'INV'
    `);

    await client.query('COMMIT');
    console.log('Migration complete: defaultTaxRate, defaultPaymentDays, invoicePrefix added to User.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
