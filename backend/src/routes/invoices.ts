import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { AppError } from "../utils/errors";
import { parseIdParam } from "../utils/params";
import { calculateInvoiceTotals, formatInvoiceNumber } from "../utils/invoiceMath";
import { renderInvoicePDF } from "../services/pdf";
import { sendEmail } from "../services/email";
import { env } from "../config/env";

export const invoicesRouter = Router();

const itemSchema = z.object({
  productId: z.number().int().positive().optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const discountTypeSchema = z.enum(["NONE", "PERCENT", "FIXED"]).default("NONE");

const createInvoiceSchema = z.object({
  clientId: z.number().int().positive(),
  dateIssued: z.string().datetime(),
  dueDate: z.string().datetime(),
  items: z.array(itemSchema).min(1, "Invoice must have at least one item"),
  discountType: discountTypeSchema.optional(),
  discountValue: z.number().nonnegative().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
}).refine(d => new Date(d.dueDate) >= new Date(d.dateIssued), {
  message: "Due date cannot be before issue date",
  path: ["dueDate"],
});

const updateInvoiceSchema = z.object({
  status: z.enum(["PENDING", "PAID", "OVERDUE"]).optional(),
  dueDate: z.string().datetime().optional(),
  items: z.array(itemSchema).min(1).optional(),
  discountType: discountTypeSchema.optional(),
  discountValue: z.number().nonnegative().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: "At least one field is required",
});

// ── helpers ────────────────────────────────────────────────────────────────

async function fetchItems(invoiceId: number) {
  const { rows } = await pool.query(
    `SELECT ii.id, ii."invoiceId", ii."productId", ii.description, ii.quantity, ii.price,
            CASE WHEN p.id IS NOT NULL
                 THEN json_build_object('id', p.id, 'name', p.name)
                 ELSE NULL END AS product
     FROM "InvoiceItem" ii
     LEFT JOIN "Product" p ON p.id = ii."productId"
     WHERE ii."invoiceId" = $1
     ORDER BY ii.id`,
    [invoiceId]
  );
  return rows;
}

async function fetchItemsBulk(invoiceIds: number[]) {
  if (invoiceIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id, "invoiceId", "productId", description, quantity, price
     FROM "InvoiceItem" WHERE "invoiceId" = ANY($1::int[]) ORDER BY id`,
    [invoiceIds]
  );
  return rows;
}

async function fetchInvoiceForPdf(id: number, byField: "id" | "publicToken", value: number | string) {
  const col = byField === "id" ? "i.id" : `i."publicToken"`;
  const { rows: [invoice] } = await pool.query(
    `SELECT i.id, i."userId", i."clientId", i.number, i.subtotal, i."discountType",
            i."discountValue", i."taxRate", i."taxAmount", i.total, i.status,
            i."dateIssued", i."dueDate", i.notes, i."publicToken", i."sentAt",
            row_to_json(c.*) AS client,
            json_build_object(
              'id', u.id, 'email', u.email,
              'companyName', u."companyName", 'companyAddress', u."companyAddress",
              'companyVat', u."companyVat", 'companyEmail', u."companyEmail",
              'companyPhone', u."companyPhone", 'companyLogoUrl', u."companyLogoUrl"
            ) AS user
     FROM "Invoice" i
     JOIN "Client" c ON c.id = i."clientId"
     JOIN "User" u ON u.id = i."userId"
     WHERE ${col} = $1`,
    [value]
  );
  if (!invoice) return null;
  invoice.items = await fetchItems(invoice.id);
  return invoice;
}

async function fetchLogoBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    if (url.startsWith("data:")) {
      const base64 = url.split(",")[1];
      return base64 ? Buffer.from(base64, "base64") : null;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ── routes ─────────────────────────────────────────────────────────────────

invoicesRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status } = req.query;
    const userId = req.user!.id;

    const statusFilter = status && ["PENDING", "PAID", "OVERDUE"].includes(status as string)
      ? ` AND i.status = $2::"InvoiceStatus"`
      : "";

    const params: unknown[] = [userId];
    if (statusFilter) params.push(status);

    const { rows: invoices } = await pool.query(
      `SELECT i.id, i."userId", i."clientId", i.number, i.subtotal, i."discountType",
              i."discountValue", i."taxRate", i."taxAmount", i.total, i.status,
              i."dateIssued", i."dueDate", i.notes, i."publicToken", i."sentAt",
              json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS client
       FROM "Invoice" i
       JOIN "Client" c ON c.id = i."clientId"
       WHERE i."userId" = $1${statusFilter}
       ORDER BY i.id DESC`,
      params
    );

    const ids = invoices.map((r: { id: number }) => r.id);
    const items = await fetchItemsBulk(ids);
    const itemsByInvoice = new Map<number, unknown[]>();
    for (const item of items) {
      const list = itemsByInvoice.get(item.invoiceId) ?? [];
      list.push(item);
      itemsByInvoice.set(item.invoiceId, list);
    }

    const result = invoices.map((inv: { id: number }) => ({
      ...inv,
      items: itemsByInvoice.get(inv.id) ?? [],
    }));

    res.json({ invoices: result });
  } catch (err) {
    next(err);
  }
});

const bulkIdsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
});

invoicesRouter.post("/bulk/mark-paid", requireAuth, validateBody(bulkIdsSchema), async (req, res, next) => {
  try {
    const { ids } = req.body as z.infer<typeof bulkIdsSchema>;
    const { rowCount } = await pool.query(
      `UPDATE "Invoice" SET status = 'PAID'::"InvoiceStatus" WHERE id = ANY($1::int[]) AND "userId" = $2`,
      [ids, req.user!.id]
    );
    res.json({ updated: rowCount });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.post("/bulk/delete", requireAuth, validateBody(bulkIdsSchema), async (req, res, next) => {
  try {
    const { ids } = req.body as z.infer<typeof bulkIdsSchema>;
    const { rowCount } = await pool.query(
      `DELETE FROM "Invoice" WHERE id = ANY($1::int[]) AND "userId" = $2`,
      [ids, req.user!.id]
    );
    res.json({ deleted: rowCount });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const { rows: [invoice] } = await pool.query(
      `SELECT i.id, i."userId", i."clientId", i.number, i.subtotal, i."discountType",
              i."discountValue", i."taxRate", i."taxAmount", i.total, i.status,
              i."dateIssued", i."dueDate", i.notes, i."publicToken", i."sentAt",
              row_to_json(c.*) AS client
       FROM "Invoice" i
       JOIN "Client" c ON c.id = i."clientId"
       WHERE i.id = $1 AND i."userId" = $2`,
      [id, req.user!.id]
    );
    if (!invoice) throw new AppError("Invoice not found", 404);

    invoice.items = await fetchItems(id);
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.post("/", requireAuth, validateBody(createInvoiceSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createInvoiceSchema>;
    const userId = req.user!.id;

    const { rows: [client] } = await pool.query(
      `SELECT id FROM "Client" WHERE id = $1 AND "userId" = $2`,
      [body.clientId, userId]
    );
    if (!client) throw new AppError("Client not found", 404);

    const discountType = body.discountType ?? "NONE";
    const discountValue = body.discountValue ?? 0;
    const taxRate = body.taxRate ?? 0;
    const { subtotal, taxAmount, total } = calculateInvoiceTotals({ items: body.items, discountType, discountValue, taxRate });

    const db = await pool.connect();
    let invoiceId: number;
    try {
      await db.query("BEGIN");

      const { rows: [user] } = await db.query(
        `UPDATE "User" SET "invoiceCounter" = "invoiceCounter" + 1 WHERE id = $1 RETURNING "invoiceCounter", "invoicePrefix"`,
        [userId]
      );
      const number = formatInvoiceNumber(user.invoiceCounter, user.invoicePrefix ?? 'INV');

      const { rows: [inv] } = await db.query(
        `INSERT INTO "Invoice"
           ("userId", "clientId", number, "dateIssued", "dueDate",
            subtotal, "baseSubtotal",
            "discountType", "discountValue", "baseDiscountValue",
            "taxRate", "taxAmount", "baseTaxAmount",
            total, "baseTotal", notes)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7::\"DiscountType\",$8,$8,$9,$10,$10,$11,$11,$12)
         RETURNING id`,
        [userId, body.clientId, number, new Date(body.dateIssued), new Date(body.dueDate),
         subtotal, discountType, discountValue, taxRate, taxAmount, total, body.notes ?? null]
      );
      invoiceId = inv.id;

      for (const item of body.items) {
        await db.query(
          `INSERT INTO "InvoiceItem" ("invoiceId", "productId", description, quantity, price, "basePrice")
           VALUES ($1,$2,$3,$4,$5,$5)`,
          [invoiceId, item.productId ?? null, item.description, item.quantity, item.price]
        );
      }

      await db.query("COMMIT");
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    } finally {
      db.release();
    }

    const { rows: [invoice] } = await pool.query(
      `SELECT i.*, json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS client
       FROM "Invoice" i JOIN "Client" c ON c.id = i."clientId" WHERE i.id = $1`,
      [invoiceId]
    );
    invoice.items = await fetchItems(invoiceId);
    res.status(201).json({ invoice });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.put("/:id", requireAuth, validateBody(updateInvoiceSchema), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const userId = req.user!.id;
    const body = req.body as z.infer<typeof updateInvoiceSchema>;

    const { rows: [existing] } = await pool.query(
      `SELECT id, "discountType", "discountValue", "taxRate" FROM "Invoice" WHERE id = $1 AND "userId" = $2`,
      [id, userId]
    );
    if (!existing) throw new AppError("Invoice not found", 404);

    const db = await pool.connect();
    try {
      await db.query("BEGIN");

      let currentItems = body.items;
      if (!currentItems) {
        const { rows } = await db.query(
          `SELECT "productId", description, quantity, price FROM "InvoiceItem" WHERE "invoiceId" = $1`,
          [id]
        );
        currentItems = rows.map((r) => ({ ...r, price: Number(r.price), productId: r.productId ?? undefined }));
      }

      const discountType = body.discountType ?? existing.discountType;
      const discountValue = body.discountValue ?? Number(existing.discountValue);
      const taxRate = body.taxRate ?? Number(existing.taxRate);
      const recalc = body.items !== undefined || body.discountType !== undefined
        || body.discountValue !== undefined || body.taxRate !== undefined;
      const { subtotal, taxAmount, total } = calculateInvoiceTotals({ items: currentItems, discountType, discountValue, taxRate });

      if (body.items) {
        await db.query(`DELETE FROM "InvoiceItem" WHERE "invoiceId" = $1`, [id]);
        for (const item of body.items) {
          await db.query(
            `INSERT INTO "InvoiceItem" ("invoiceId", "productId", description, quantity, price, "basePrice")
             VALUES ($1,$2,$3,$4,$5,$5)`,
            [id, item.productId ?? null, item.description, item.quantity, item.price]
          );
        }
      }

      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.status !== undefined) { sets.push(`status = $${vals.push(body.status)}::"InvoiceStatus"`); }
      if (body.dueDate !== undefined) { sets.push(`"dueDate" = $${vals.push(new Date(body.dueDate))}`); }
      if (body.notes !== undefined) { sets.push(`notes = $${vals.push(body.notes)}`); }
      if (body.discountType !== undefined) { sets.push(`"discountType" = $${vals.push(discountType)}::"DiscountType"`); }
      if (body.discountValue !== undefined) { sets.push(`"discountValue" = $${vals.push(discountValue)}`); }
      if (body.taxRate !== undefined) { sets.push(`"taxRate" = $${vals.push(taxRate)}`); }
      if (recalc) {
        sets.push(`subtotal = $${vals.push(subtotal)}`);
        sets.push(`"baseSubtotal" = $${vals.push(subtotal)}`);
        sets.push(`"taxAmount" = $${vals.push(taxAmount)}`);
        sets.push(`"baseTaxAmount" = $${vals.push(taxAmount)}`);
        sets.push(`total = $${vals.push(total)}`);
        sets.push(`"baseTotal" = $${vals.push(total)}`);
      }
      if (body.discountValue !== undefined) {
        sets.push(`"baseDiscountValue" = $${vals.push(discountValue)}`);
      }
      vals.push(id);
      await db.query(`UPDATE "Invoice" SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);

      await db.query("COMMIT");
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    } finally {
      db.release();
    }

    const { rows: [invoice] } = await pool.query(
      `SELECT i.*, json_build_object('id', c.id, 'name', c.name, 'email', c.email) AS client
       FROM "Invoice" i JOIN "Client" c ON c.id = i."clientId" WHERE i.id = $1`,
      [id]
    );
    invoice.items = await fetchItems(id);
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/:id/pdf", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const invoice = await fetchInvoiceForPdf(id, "id", id);
    if (!invoice || invoice.userId !== req.user!.id) throw new AppError("Invoice not found", 404);

    const logoBuffer = await fetchLogoBuffer(invoice.user.companyLogoUrl);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoice.number}.pdf"`);
    renderInvoicePDF(invoice, logoBuffer).pipe(res);
  } catch (err) {
    next(err);
  }
});

const sendSchema = z.object({
  to: z.string().email().optional(),
  message: z.string().max(2000).optional(),
});

invoicesRouter.post("/:id/send", requireAuth, validateBody(sendSchema), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const body = req.body as z.infer<typeof sendSchema>;

    let invoice = await fetchInvoiceForPdf(id, "id", id);
    if (!invoice || invoice.userId !== req.user!.id) throw new AppError("Invoice not found", 404);

    const recipient = body.to ?? invoice.client.email;
    if (!recipient) throw new AppError("No recipient email", 400);

    if (!invoice.publicToken) {
      const publicToken = randomBytes(24).toString("hex");
      await pool.query(`UPDATE "Invoice" SET "publicToken" = $1 WHERE id = $2`, [publicToken, id]);
      invoice.publicToken = publicToken;
    }

    const logoBuffer = await fetchLogoBuffer(invoice.user.companyLogoUrl);
    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const stream = renderInvoicePDF(invoice, logoBuffer);
      const chunks: Buffer[] = [];
      stream.on("data", (c) => chunks.push(c as Buffer));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });

    const publicUrl = `${env.APP_URL}/pay/${invoice.publicToken}`;
    const company = invoice.user.companyName ?? "BillFlow";
    const text =
      (body.message ?? `Please find attached invoice ${invoice.number}.`) +
      `\n\nView online: ${publicUrl}\n\n— ${company}`;

    const result = await sendEmail({
      to: recipient,
      subject: `Invoice ${invoice.number} — ${company}`,
      text,
      attachments: [{ filename: `${invoice.number}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
    });

    await pool.query(`UPDATE "Invoice" SET "sentAt" = NOW() WHERE id = $1`, [id]);

    res.json({ ok: true, mocked: result.mocked, recipient, publicUrl });
  } catch (err) {
    next(err);
  }
});

const paymentSchema = z.object({
  amount: z.number().positive().optional(),
  paidAt: z.string().datetime().optional(),
  method: z.enum(["cash", "bank_transfer", "card", "check", "other"]).default("other"),
  reference: z.string().max(200).optional(),
});

invoicesRouter.get("/:id/payments", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const { rows: [inv] } = await pool.query(
      `SELECT id FROM "Invoice" WHERE id = $1 AND "userId" = $2`,
      [id, req.user!.id]
    );
    if (!inv) throw new AppError("Invoice not found", 404);

    const { rows: payments } = await pool.query(
      `SELECT id, "invoiceId", amount, "paidAt", method, reference
       FROM "Payment" WHERE "invoiceId" = $1 ORDER BY "paidAt" DESC`,
      [id]
    );
    res.json({ payments });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.post("/:id/payments", requireAuth, validateBody(paymentSchema), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const userId = req.user!.id;
    const body = req.body as z.infer<typeof paymentSchema>;

    const { rows: [invoice] } = await pool.query(
      `SELECT id, total FROM "Invoice" WHERE id = $1 AND "userId" = $2`,
      [id, userId]
    );
    if (!invoice) throw new AppError("Invoice not found", 404);

    const amount = body.amount ?? Number(invoice.total);
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();

    const { rows: [payment] } = await pool.query(
      `INSERT INTO "Payment" ("invoiceId", amount, "paidAt", method, reference)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, amount, paidAt, body.method, body.reference ?? null]
    );

    await pool.query(
      `UPDATE "Invoice" SET status = 'PAID'::"InvoiceStatus" WHERE id = $1`,
      [id]
    );

    res.status(201).json({ payment });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const { rowCount } = await pool.query(
      `DELETE FROM "Invoice" WHERE id = $1 AND "userId" = $2`,
      [id, req.user!.id]
    );
    if (!rowCount) throw new AppError("Invoice not found", 404);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
