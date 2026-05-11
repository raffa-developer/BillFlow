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
    await client.query(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR'`
    );
    console.log('Migration complete: added currency column to User table');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
