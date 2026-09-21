import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { pool } from "../db/pool";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { hashPassword, verifyPassword, passwordSetSchema } from "../utils/password";
import { signToken } from "../utils/jwt";
import { USER_SELECT } from "../utils/userSelect";
import { requireAuth } from "../middleware/auth";
import { sendEmail } from "../services/email";
import { env } from "../config/env";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many accounts created from this address, please try again later." },
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const authRouter = Router();

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8).max(128);

const registerSchema = z.object({ email: emailSchema, password: passwordSetSchema });
const loginSchema = z.object({ email: emailSchema, password: passwordSchema });

authRouter.post("/register", registerLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email: rawEmail, password } = req.body as z.infer<typeof registerSchema>;
    const email = normalizeEmail(rawEmail);

    const { rows: existing } = await pool.query(
      `SELECT id FROM "User" WHERE lower(email) = $1`,
      [email]
    );
    if (existing[0]) throw new AppError("Email already registered", 409);

    const passwordHash = await hashPassword(password);

    let user;
    try {
      const { rows: [row] } = await pool.query(
        `INSERT INTO "User" (email, "passwordHash") VALUES ($1, $2)
         RETURNING ${USER_SELECT}`,
        [email, passwordHash]
      );
      user = row;
    } catch (err) {
      // Unique violation from a concurrent registration with the same email
      if ((err as { code?: string }).code === "23505") {
        throw new AppError("Email already registered", 409);
      }
      throw err;
    }

    const token = signToken({ userId: user.id, tv: 0 });
    return res.status(201).json({ token, user });
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/login", authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email: rawEmail, password } = req.body as z.infer<typeof loginSchema>;
    const email = normalizeEmail(rawEmail);

    const { rows: [user] } = await pool.query(
      `SELECT ${USER_SELECT}, "passwordHash", "tokenVersion" FROM "User" WHERE lower(email) = $1`,
      [email]
    );
    if (!user) throw new AppError("Invalid credentials", 401);

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new AppError("Invalid credentials", 401);

    const token = signToken({ userId: user.id, tv: user.tokenVersion });
    const { passwordHash: _ph, tokenVersion: _tv, ...publicUser } = user;
    return res.json({ token, user: publicUser });
  } catch (err) {
    return next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
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

const forgotSchema = z.object({ email: emailSchema });

authRouter.post("/forgot", authLimiter, validateBody(forgotSchema), async (req, res, next) => {
  try {
    const { email: rawEmail } = req.body as z.infer<typeof forgotSchema>;
    const email = normalizeEmail(rawEmail);

    const { rows: [user] } = await pool.query(
      `SELECT id FROM "User" WHERE lower(email) = $1`,
      [email]
    );

    if (user) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
      await pool.query(
        `INSERT INTO "PasswordResetToken" ("userId", token, "expiresAt") VALUES ($1, $2, $3)`,
        [user.id, token, expiresAt]
      );

      const resetUrl = `${env.APP_URL}/reset/${token}`;
      try {
        await sendEmail({
          to: email,
          subject: "Reset your BillFlow password",
          text: `Use the link below to reset your BillFlow password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        });
      } catch (err) {
        // Don't leak account existence to the caller; log for operators.
        console.error("[auth] password reset email failed", err);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const resetSchema = z.object({
  token: z.string().min(20),
  newPassword: passwordSetSchema,
});

authRouter.post("/reset", validateBody(resetSchema), async (req, res, next) => {
  try {
    const { token, newPassword } = req.body as z.infer<typeof resetSchema>;

    const passwordHash = await hashPassword(newPassword);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Atomically claim the token so two concurrent resets can't both succeed.
      const { rows: [record] } = await client.query(
        `UPDATE "PasswordResetToken" SET "usedAt" = NOW()
         WHERE token = $1 AND "usedAt" IS NULL AND "expiresAt" > NOW()
         RETURNING "userId"`,
        [token]
      );
      if (!record) throw new AppError("Invalid or expired token", 400);

      await client.query(
        `UPDATE "User" SET "passwordHash" = $1, "tokenVersion" = "tokenVersion" + 1 WHERE id = $2`,
        [passwordHash, record.userId]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
