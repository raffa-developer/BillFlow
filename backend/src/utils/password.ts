import bcrypt from "bcrypt";
import { z } from "zod";
import { env } from "../config/env";

// bcrypt only uses the first 72 bytes; reject longer passwords when setting one.
export const passwordSetSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((p) => Buffer.byteLength(p, "utf8") <= 72, {
    message: "Password must be at most 72 bytes",
  });

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = env.BCRYPT_SALT_ROUNDS;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
