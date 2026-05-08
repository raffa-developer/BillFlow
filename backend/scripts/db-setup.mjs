import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const dotenv = require("dotenv");

const __dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dir, "../.env") });

const sql = readFileSync(join(__dir, "../schema.sql"), "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  console.log("Schema applied successfully.");
} catch (err) {
  if (err.message?.includes("already exists")) {
    console.log("Tables already exist — schema already applied.");
  } else {
    console.error("Error:", err.message);
    process.exit(1);
  }
} finally {
  await pool.end();
}
