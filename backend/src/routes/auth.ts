import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { pool } from "../db/pool";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { requireAuth } from "../middleware/auth";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later." },
});

export const authRouter = Router();

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8).max(128);

const registerSchema = z.object({ email: emailSchema, password: passwordSchema });
const loginSchema = z.object({ email: emailSchema, password: passwordSchema });

authRouter.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof registerSchema>;

    const { rows: existing } = await pool.query(
      `SELECT id FROM "User" WHERE email = $1`,
      [email]
    );
    if (existing[0]) throw new AppError("Email already registered", 409);

    const passwordHash = await hashPassword(password);

    const { rows: [user] } = await pool.query(
      `INSERT INTO "User" (email, "passwordHash") VALUES ($1, $2)
       RETURNING id, email, "createdAt"`,
      [email, passwordHash]
    );

    const token = signToken({ userId: user.id });
    return res.status(201).json({ token, user });
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/login", authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const { rows: [user] } = await pool.query(
      `SELECT id, email, "passwordHash", "createdAt" FROM "User" WHERE email = $1`,
      [email]
    );
    if (!user) throw new AppError("Invalid credentials", 401);

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new AppError("Invalid credentials", 401);

    const token = signToken({ userId: user.id });
    return res.json({ token, user: { id: user.id, email: user.email, createdAt: user.createdAt } });
  } catch (err) {
    return next(err);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const forgotSchema = z.object({ email: emailSchema });

authRouter.post("/forgot", authLimiter, validateBody(forgotSchema), async (req, res, next) => {
  try {
    const { email } = req.body as z.infer<typeof forgotSchema>;

    const { rows: [user] } = await pool.query(
      `SELECT id FROM "User" WHERE email = $1`,
      [email]
    );

    if (user) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
      await pool.query(
        `INSERT INTO "PasswordResetToken" ("userId", token, "expiresAt") VALUES ($1, $2, $3)`,
        [user.id, token, expiresAt]
      );

    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const resetSchema = z.object({
  token: z.string().min(20),
  newPassword: passwordSchema,
});

authRouter.post("/reset", validateBody(resetSchema), async (req, res, next) => {
  try {
    const { token, newPassword } = req.body as z.infer<typeof resetSchema>;

    const { rows: [record] } = await pool.query(
      `SELECT id, "userId", "usedAt", "expiresAt" FROM "PasswordResetToken" WHERE token = $1`,
      [token]
    );
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError("Invalid or expired token", 400);
    }

    const passwordHash = await hashPassword(newPassword);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE "User" SET "passwordHash" = $1 WHERE id = $2`, [passwordHash, record.userId]);
      await client.query(`UPDATE "PasswordResetToken" SET "usedAt" = NOW() WHERE id = $1`, [record.id]);
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
