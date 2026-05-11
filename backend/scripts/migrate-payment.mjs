import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Payment" (
        "id"        SERIAL          PRIMARY KEY,
        "invoiceId" INTEGER         NOT NULL REFERENCES "Invoice"("id") ON DELETE CASCADE,
        "amount"    DECIMAL(12, 2)  NOT NULL,
        "paidAt"    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        "method"    TEXT            NOT NULL DEFAULT 'other',
        "reference" TEXT
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");
    `);
    console.log('Migration complete: Payment table created.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
