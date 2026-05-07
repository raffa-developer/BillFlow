import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";

export const meRouter = Router();

const userSelect = {
  id: true,
  email: true,
  createdAt: true,
  companyName: true,
  companyAddress: true,
  companyVat: true,
  companyEmail: true,
  companyPhone: true,
  companyLogoUrl: true,
} as const;

// GET /api/me  → full user incl. company profile
meRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: userSelect,
    });
    if (!user) throw new AppError("User not found", 404);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/me/company  → update company branding fields
const companySchema = z.object({
  companyName: z.string().max(120).nullable().optional(),
  companyAddress: z.string().max(500).nullable().optional(),
  companyVat: z.string().max(60).nullable().optional(),
  companyEmail: z.string().email().nullable().optional().or(z.literal("")),
  companyPhone: z.string().max(40).nullable().optional(),
  companyLogoUrl: z.string().url().nullable().optional().or(z.literal("")),
});

meRouter.put(
  "/company",
  requireAuth,
  validateBody(companySchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof companySchema>;
      const data: Record<string, string | null> = {};
      for (const k of [
        "companyName",
        "companyAddress",
        "companyVat",
        "companyEmail",
        "companyPhone",
        "companyLogoUrl",
      ] as const) {
        if (k in body) {
          const v = body[k];
          data[k] = v === "" ? null : (v ?? null);
        }
      }

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data,
        select: userSelect,
      });
      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/me/email  → change email; requires current password
const emailChangeSchema = z.object({
  email: z.string().email(),
  currentPassword: z.string().min(1),
});

meRouter.put(
  "/email",
  requireAuth,
  validateBody(emailChangeSchema),
  async (req, res, next) => {
    try {
      const { email, currentPassword } = req.body as z.infer<
        typeof emailChangeSchema
      >;
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError("User not found", 404);

      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) throw new AppError("Incorrect password", 401);

      if (email !== user.email) {
        const taken = await prisma.user.findUnique({ where: { email } });
        if (taken) throw new AppError("Email already in use", 409);
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { email },
        select: userSelect,
      });

      const token = signToken({ userId: updated.id });
      res.json({ user: updated, token });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/me/password  → change password
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

meRouter.put(
  "/password",
  requireAuth,
  validateBody(passwordChangeSchema),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body as z.infer<
        typeof passwordChangeSchema
      >;
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError("User not found", 404);

      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) throw new AppError("Incorrect password", 401);

      const passwordHash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);
