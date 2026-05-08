import { Pool, types } from "pg";
import { env } from "../config/env";

// Return NUMERIC/DECIMAL columns as JS numbers instead of strings
types.setTypeParser(1700, (val) => parseFloat(val));

export const pool = new Pool({ connectionString: env.DATABASE_URL });
