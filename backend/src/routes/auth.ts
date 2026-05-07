import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8).max(128);

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

authRouter.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof registerSchema>;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("Email already registered", 409);
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true }
    });

    const token = signToken({ userId: user.id });

    return res.status(201).json({ token, user });
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = signToken({ userId: user.id });

    return res.json({ token, user: { id: user.id, email: user.email, createdAt: user.createdAt } });
  } catch (err) {
    return next(err);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/forgot — issue reset token (email integration in Phase 2)
const forgotSchema = z.object({ email: emailSchema });

authRouter.post("/forgot", validateBody(forgotSchema), async (req, res, next) => {
  try {
    const { email } = req.body as z.infer<typeof forgotSchema>;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond identically — never leak whether the email exists
    if (user) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1h
      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });
      // TODO Phase 2.3: email this link to the user
      // eslint-disable-next-line no-console
      console.log(`[password-reset] /reset/${token} (user ${user.id})`);
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset — consume token + set new password
const resetSchema = z.object({
  token: z.string().min(20),
  newPassword: passwordSchema,
});

authRouter.post("/reset", validateBody(resetSchema), async (req, res, next) => {
  try {
    const { token, newPassword } = req.body as z.infer<typeof resetSchema>;

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError("Invalid or expired token", 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
