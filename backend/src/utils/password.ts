import bcrypt from "bcrypt";
import { env } from "../config/env";

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = env.BCRYPT_SALT_ROUNDS;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
