import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";

export const meRouter = Router();

const USER_SELECT = `id, email, "createdAt", "companyName", "companyAddress", "companyVat", "companyEmail", "companyPhone", "companyLogoUrl"`;
const COMPANY_COLS = ["companyName", "companyAddress", "companyVat", "companyEmail", "companyPhone", "companyLogoUrl"] as const;

meRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows: [user] } = await pool.query(
      `SELECT ${USER_SELECT} FROM "User" WHERE id = $1`,
      [req.user!.id]
    );
    if (!user) throw new AppError("User not found", 404);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

const companySchema = z.object({
  companyName: z.string().max(120).nullable().optional(),
  companyAddress: z.string().max(500).nullable().optional(),
  companyVat: z.string().max(60).nullable().optional(),
  companyEmail: z.string().email().nullable().optional().or(z.literal("")),
  companyPhone: z.string().max(40).nullable().optional(),
  companyLogoUrl: z.string().url().nullable().optional().or(z.literal("")),
});

meRouter.put("/company", requireAuth, validateBody(companySchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof companySchema>;

    const fields: string[] = [];
    const values: (string | null)[] = [];
    for (const col of COMPANY_COLS) {
      if (col in body) {
        fields.push(col);
        const v = body[col];
        values.push(v === "" ? null : (v ?? null));
      }
    }

    values.push(req.user!.id as unknown as string);
    const set = fields.length > 0
      ? fields.map((f, i) => `"${f}" = $${i + 1}`).join(", ") + ","
      : "";

    const { rows: [user] } = await pool.query(
      `UPDATE "User" SET ${set} id = id
       WHERE id = $${fields.length + 1}
       RETURNING ${USER_SELECT}`,
      values
    );
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

const emailChangeSchema = z.object({
  email: z.string().email(),
  currentPassword: z.string().min(1),
});

meRouter.put("/email", requireAuth, validateBody(emailChangeSchema), async (req, res, next) => {
  try {
    const { email, currentPassword } = req.body as z.infer<typeof emailChangeSchema>;
    const userId = req.user!.id;

    const { rows: [user] } = await pool.query(
      `SELECT id, email, "passwordHash" FROM "User" WHERE id = $1`,
      [userId]
    );
    if (!user) throw new AppError("User not found", 404);

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new AppError("Incorrect password", 401);

    if (email !== user.email) {
      const { rows: [taken] } = await pool.query(
        `SELECT id FROM "User" WHERE email = $1`,
        [email]
      );
      if (taken) throw new AppError("Email already in use", 409);
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE "User" SET email = $1 WHERE id = $2 RETURNING ${USER_SELECT}`,
      [email, userId]
    );

    const token = signToken({ userId: updated.id });
    res.json({ user: updated, token });
  } catch (err) {
    next(err);
  }
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

meRouter.put("/password", requireAuth, validateBody(passwordChangeSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as z.infer<typeof passwordChangeSchema>;
    const userId = req.user!.id;

    const { rows: [user] } = await pool.query(
      `SELECT id, "passwordHash" FROM "User" WHERE id = $1`,
      [userId]
    );
    if (!user) throw new AppError("User not found", 404);

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new AppError("Incorrect password", 401);

    const passwordHash = await hashPassword(newPassword);
    await pool.query(`UPDATE "User" SET "passwordHash" = $1 WHERE id = $2`, [passwordHash, userId]);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
