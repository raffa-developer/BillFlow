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
    await client.query('BEGIN');
    await client.query(
      `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "baseAmount" DECIMAL(15,6)`
    );
    // Existing payments were stored in the user's current currency; assume base
    // until the next currency switch (best effort — historical rates are unknown).
    await client.query(`UPDATE "Payment" SET "baseAmount" = amount WHERE "baseAmount" IS NULL`);
    await client.query(`ALTER TABLE "Payment" ALTER COLUMN "baseAmount" SET NOT NULL`);
    await client.query('COMMIT');
    console.log('Migration complete: Payment.baseAmount added.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
