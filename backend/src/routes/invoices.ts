import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { prisma } from "../db/prisma";
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
});

const updateInvoiceSchema = z
  .object({
    status: z.enum(["PENDING", "PAID", "OVERDUE"]).optional(),
    dueDate: z.string().datetime().optional(),
    items: z.array(itemSchema).min(1).optional(),
    discountType: discountTypeSchema.optional(),
    discountValue: z.number().nonnegative().optional(),
    taxRate: z.number().min(0).max(100).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

// GET /api/invoices
invoicesRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status } = req.query;

    const where: Record<string, unknown> = { userId: req.user!.id };
    if (status && ["PENDING", "PAID", "OVERDUE"].includes(status as string)) {
      where.status = status;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true } },
        items: true,
      },
      orderBy: { id: "desc" },
    });

    res.json({ invoices });
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices/:id
invoicesRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: req.user!.id },
      include: {
        client: true,
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!invoice) throw new AppError("Invoice not found", 404);

    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices
invoicesRouter.post(
  "/",
  requireAuth,
  validateBody(createInvoiceSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createInvoiceSchema>;
      const userId = req.user!.id;

      const client = await prisma.client.findFirst({
        where: { id: body.clientId, userId },
      });
      if (!client) throw new AppError("Client not found", 404);

      const discountType = body.discountType ?? "NONE";
      const discountValue = body.discountValue ?? 0;
      const taxRate = body.taxRate ?? 0;

      const { subtotal, taxAmount, total } = calculateInvoiceTotals({
        items: body.items,
        discountType,
        discountValue,
        taxRate,
      });

      const invoice = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { invoiceCounter: { increment: 1 } },
          select: { invoiceCounter: true },
        });
        const number = formatInvoiceNumber(updatedUser.invoiceCounter);

        return tx.invoice.create({
          data: {
            userId,
            clientId: body.clientId,
            number,
            dateIssued: new Date(body.dateIssued),
            dueDate: new Date(body.dueDate),
            subtotal,
            discountType,
            discountValue,
            taxRate,
            taxAmount,
            total,
            notes: body.notes ?? null,
            items: {
              create: body.items.map((item) => ({
                productId: item.productId ?? null,
                description: item.description,
                quantity: item.quantity,
                price: item.price,
              })),
            },
          },
          include: {
            client: { select: { id: true, name: true, email: true } },
            items: true,
          },
        });
      });

      res.status(201).json({ invoice });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/invoices/:id
invoicesRouter.put(
  "/:id",
  requireAuth,
  validateBody(updateInvoiceSchema),
  async (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id);
      const userId = req.user!.id;
      const body = req.body as z.infer<typeof updateInvoiceSchema>;

      const existing = await prisma.invoice.findFirst({
        where: { id, userId },
        include: { items: true },
      });
      if (!existing) throw new AppError("Invoice not found", 404);

      const invoice = await prisma.$transaction(async (tx) => {
        const itemsUsed =
          body.items ??
          existing.items.map((it) => ({
            quantity: it.quantity,
            price: Number(it.price),
            description: it.description,
            productId: it.productId ?? undefined,
          }));

        const discountType = body.discountType ?? existing.discountType;
        const discountValue =
          body.discountValue ?? Number(existing.discountValue);
        const taxRate = body.taxRate ?? Number(existing.taxRate);

        const totals = calculateInvoiceTotals({
          items: itemsUsed,
          discountType,
          discountValue,
          taxRate,
        });

        if (body.items) {
          await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
          await tx.invoiceItem.createMany({
            data: body.items.map((item) => ({
              invoiceId: id,
              productId: item.productId ?? null,
              description: item.description,
              quantity: item.quantity,
              price: item.price,
            })),
          });
        }

        const recalc =
          body.items !== undefined ||
          body.discountType !== undefined ||
          body.discountValue !== undefined ||
          body.taxRate !== undefined;

        return tx.invoice.update({
          where: { id },
          data: {
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.dueDate !== undefined
              ? { dueDate: new Date(body.dueDate) }
              : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
            ...(body.discountType !== undefined ? { discountType } : {}),
            ...(body.discountValue !== undefined ? { discountValue } : {}),
            ...(body.taxRate !== undefined ? { taxRate } : {}),
            ...(recalc
              ? {
                  subtotal: totals.subtotal,
                  taxAmount: totals.taxAmount,
                  total: totals.total,
                }
              : {}),
          },
          include: {
            client: { select: { id: true, name: true, email: true } },
            items: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        });
      });

      res.json({ invoice });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/invoices/:id/pdf — download PDF
invoicesRouter.get("/:id/pdf", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: req.user!.id },
      include: { client: true, items: true, user: true },
    });
    if (!invoice) throw new AppError("Invoice not found", 404);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${invoice.number}.pdf"`
    );
    const stream = renderInvoicePDF(invoice);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices/:id/send — email PDF + public link to client
const sendSchema = z.object({
  to: z.string().email().optional(),
  message: z.string().max(2000).optional(),
});

invoicesRouter.post(
  "/:id/send",
  requireAuth,
  validateBody(sendSchema),
  async (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id);
      const body = req.body as z.infer<typeof sendSchema>;
      const userId = req.user!.id;

      const invoice = await prisma.invoice.findFirst({
        where: { id, userId },
        include: { client: true, items: true, user: true },
      });
      if (!invoice) throw new AppError("Invoice not found", 404);

      const recipient = body.to ?? invoice.client.email;
      if (!recipient) throw new AppError("No recipient email", 400);

      // Ensure public token exists
      let publicToken = invoice.publicToken;
      if (!publicToken) {
        publicToken = randomBytes(24).toString("hex");
        await prisma.invoice.update({
          where: { id },
          data: { publicToken },
        });
      }

      // Buffer the PDF stream
      const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
        const stream = renderInvoicePDF(invoice);
        const chunks: Buffer[] = [];
        stream.on("data", (c) => chunks.push(c as Buffer));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });

      const publicUrl = `${env.APP_URL}/pay/${publicToken}`;
      const company = invoice.user.companyName ?? "BillFlow";
      const text =
        (body.message ?? `Segue em anexo a fatura ${invoice.number}.`) +
        `\n\nVisualizar online: ${publicUrl}\n\n— ${company}`;

      const result = await sendEmail({
        to: recipient,
        subject: `Fatura ${invoice.number} — ${company}`,
        text,
        attachments: [
          {
            filename: `${invoice.number}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      await prisma.invoice.update({
        where: { id },
        data: { sentAt: new Date() },
      });

      res.json({ ok: true, mocked: result.mocked, recipient, publicUrl });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/invoices/:id
invoicesRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);

    const existing = await prisma.invoice.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) throw new AppError("Invoice not found", 404);

    await prisma.invoice.delete({ where: { id } });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
