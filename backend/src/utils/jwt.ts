import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type JwtPayload = {
  userId: number;
  /** Token version — must match User.tokenVersion; bumped on password change/reset. */
  tv?: number;
};

export function signToken(payload: JwtPayload): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as any);
}
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
