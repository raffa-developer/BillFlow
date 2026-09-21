import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { hashPassword, verifyPassword, passwordSetSchema } from "../utils/password";
import { signToken } from "../utils/jwt";
import { USER_SELECT } from "../utils/userSelect";

export const meRouter = Router();

const COMPANY_COLS = ["companyName", "companyAddress", "companyVat", "companyEmail", "companyPhone", "companyLogoUrl", "defaultTaxRate", "defaultPaymentDays", "invoicePrefix"] as const;

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
  defaultTaxRate: z.coerce.number().min(0).max(100).optional(),
  defaultPaymentDays: z.coerce.number().int().min(1).max(365).optional(),
  invoicePrefix: z.string().max(20).optional(),
});

meRouter.put("/company", requireAuth, validateBody(companySchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof companySchema>;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const col of COMPANY_COLS) {
      if (col in body) {
        fields.push(col);
        const v = body[col];
        if (col === "invoicePrefix") {
          values.push(typeof v === "string" && v.trim() !== "" ? v.trim() : "INV");
        } else {
          values.push(v === "" ? null : (v ?? null));
        }
      }
    }

    values.push(req.user!.id);
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
    const { email: rawEmail, currentPassword } = req.body as z.infer<typeof emailChangeSchema>;
    const email = rawEmail.trim().toLowerCase();
    const userId = req.user!.id;

    const { rows: [user] } = await pool.query(
      `SELECT id, email, "passwordHash", "tokenVersion" FROM "User" WHERE id = $1`,
      [userId]
    );
    if (!user) throw new AppError("User not found", 404);

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new AppError("Incorrect password", 401);

    if (email !== user.email.toLowerCase()) {
      const { rows: [taken] } = await pool.query(
        `SELECT id FROM "User" WHERE lower(email) = $1 AND id <> $2`,
        [email, userId]
      );
      if (taken) throw new AppError("Email already in use", 409);
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE "User" SET email = $1 WHERE id = $2 RETURNING ${USER_SELECT}`,
      [email, userId]
    );

    const token = signToken({ userId: updated.id, tv: user.tokenVersion });
    res.json({ user: updated, token });
  } catch (err) {
    next(err);
  }
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSetSchema,
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
    await pool.query(
      `UPDATE "User" SET "passwordHash" = $1, "tokenVersion" = "tokenVersion" + 1 WHERE id = $2`,
      [passwordHash, userId]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'BRL'] as const;

meRouter.get('/exchange-rate', requireAuth, async (req, res, next) => {
  try {
    const from = String(req.query.from ?? 'EUR').toUpperCase();
    const to   = String(req.query.to   ?? 'USD').toUpperCase();

    const supported = SUPPORTED_CURRENCIES as readonly string[];
    if (!supported.includes(from) || !supported.includes(to)) {
      throw new AppError('Unsupported currency', 400);
    }
    if (from === to) return res.json({ rate: 1 });

    const url = new URL('https://api.frankfurter.app/latest');
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);

    const response = await fetch(url);
    if (!response.ok) throw new AppError('Exchange rate service unavailable', 502);

    const data = await response.json() as { rates: Record<string, number> };
    const rate = data.rates[to];
    if (!rate) throw new AppError(`No rate found for ${from}→${to}`, 400);

    res.json({ rate });
  } catch (err) {
    next(err);
  }
});

const currencySchema = z.object({
  currency: z.enum(SUPPORTED_CURRENCIES),
  // rate from baseCurrency → currency (required when switching away from base)
  rate: z.number().positive().finite().optional(),
});

meRouter.put('/currency', requireAuth, validateBody(currencySchema), async (req, res, next) => {
  try {
    const { currency, rate: requestedRate } = req.body as z.infer<typeof currencySchema>;
    const userId = req.user!.id;

    const { rows: [userData] } = await pool.query(
      `SELECT "baseCurrency" FROM "User" WHERE id = $1`, [userId]
    );
    const returningToBase = currency === userData.baseCurrency;
    if (!returningToBase && requestedRate === undefined) {
      throw new AppError("Exchange rate is required when switching currency", 400);
    }
    const rate = returningToBase ? 1 : (requestedRate as number);

    const db = await pool.connect();
    try {
      await db.query('BEGIN');

      if (returningToBase) {
        // Restore exact original values — no rounding loss
        await db.query(
          `UPDATE "InvoiceItem" ii
           SET price = ROUND(ii."basePrice"::numeric, 2)
           FROM "Invoice" inv
           WHERE ii."invoiceId" = inv.id AND inv."userId" = $1`,
          [userId]
        );
        await db.query(
          `UPDATE "Invoice"
           SET
             subtotal        = ROUND("baseSubtotal"::numeric, 2),
             "discountValue" = CASE
               WHEN "discountType" = 'FIXED' THEN ROUND("baseDiscountValue"::numeric, 2)
               ELSE "discountValue"
             END,
             "taxAmount"     = ROUND("baseTaxAmount"::numeric, 2),
             total           = ROUND("baseTotal"::numeric, 2)
           WHERE "userId" = $1`,
          [userId]
        );
        await db.query(
          `UPDATE "Product" SET price = ROUND("basePrice"::numeric, 2) WHERE "userId" = $1`,
          [userId]
        );
        await db.query(
          `UPDATE "Payment" p
           SET amount = ROUND(p."baseAmount"::numeric, 2)
           FROM "Invoice" inv
           WHERE p."invoiceId" = inv.id AND inv."userId" = $1`,
          [userId]
        );
      } else {
        // Always convert FROM base values (not from already-converted values)
        await db.query(
          `UPDATE "InvoiceItem" ii
           SET price = ROUND((ii."basePrice" * $1)::numeric, 2)
           FROM "Invoice" inv
           WHERE ii."invoiceId" = inv.id AND inv."userId" = $2`,
          [rate, userId]
        );
        await db.query(
          `UPDATE "Invoice"
           SET
             subtotal        = ROUND(("baseSubtotal"      * $1)::numeric, 2),
             "discountValue" = CASE
               WHEN "discountType" = 'FIXED' THEN ROUND(("baseDiscountValue" * $1)::numeric, 2)
               ELSE "discountValue"
             END,
             "taxAmount"     = ROUND(("baseTaxAmount"     * $1)::numeric, 2),
             total           = ROUND(("baseTotal"         * $1)::numeric, 2)
           WHERE "userId" = $2`,
          [rate, userId]
        );
        await db.query(
          `UPDATE "Product" SET price = ROUND(("basePrice" * $1)::numeric, 2) WHERE "userId" = $2`,
          [rate, userId]
        );
        await db.query(
          `UPDATE "Payment" p
           SET amount = ROUND((p."baseAmount" * $1)::numeric, 2)
           FROM "Invoice" inv
           WHERE p."invoiceId" = inv.id AND inv."userId" = $2`,
          [rate, userId]
        );
      }

      const { rows: [user] } = await db.query(
        `UPDATE "User" SET "currency" = $1, "currencyRate" = $2 WHERE id = $3 RETURNING ${USER_SELECT}`,
        [currency, returningToBase ? 1 : rate, userId]
      );

      await db.query('COMMIT');
      res.json({ user });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
  } catch (err) {
    next(err);
  }
});
