import { NextFunction, Request, Response } from "express";
import { pool } from "../db/pool";
import { verifyToken } from "../utils/jwt";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyToken(token);
    const { rows } = await pool.query<{ id: number; email: string }>(
      `SELECT id, email FROM "User" WHERE id = $1`,
      [payload.userId]
    );

    if (!rows[0]) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = rows[0];
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
