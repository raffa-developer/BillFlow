import { Router } from "express";
import { pool } from "../db/pool";
import { AppError } from "../utils/errors";
import { renderInvoicePDF } from "../services/pdf";
import { fetchLogoBuffer } from "../utils/logo";
import { safeFilename } from "../utils/filename";

export const publicInvoicesRouter = Router();

async function fetchByToken(token: string) {
  const { rows: [invoice] } = await pool.query(
    `SELECT i.id, i."userId", i."clientId", i.number, i.subtotal, i."discountType",
            i."discountValue", i."taxRate", i."taxAmount", i.total, i.status,
            i."dateIssued", i."dueDate", i.notes, i."publicToken", i."sentAt",
            json_build_object('name', c.name, 'email', c.email, 'address', c.address) AS client,
            json_build_object(
              'companyName', u."companyName", 'companyAddress', u."companyAddress",
              'companyVat', u."companyVat", 'companyEmail', u."companyEmail",
              'companyPhone', u."companyPhone", 'companyLogoUrl', u."companyLogoUrl",
              'currency', u.currency
            ) AS user
     FROM "Invoice" i
     JOIN "Client" c ON c.id = i."clientId"
     JOIN "User" u ON u.id = i."userId"
     WHERE i."publicToken" = $1`,
    [token]
  );
  if (!invoice) return null;

  const { rows: items } = await pool.query(
    `SELECT id, "invoiceId", "productId", description, quantity, price
     FROM "InvoiceItem" WHERE "invoiceId" = $1 ORDER BY id`,
    [invoice.id]
  );
  invoice.items = items;
  return invoice;
}

publicInvoicesRouter.get("/:token", async (req, res, next) => {
  try {
    const invoice = await fetchByToken(req.params.token);
    if (!invoice) throw new AppError("Invoice not found", 404);
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

publicInvoicesRouter.get("/:token/pdf", async (req, res, next) => {
  try {
    const invoice = await fetchByToken(req.params.token);
    if (!invoice) throw new AppError("Invoice not found", 404);

    const logoBuffer = await fetchLogoBuffer(invoice.user.companyLogoUrl);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename(invoice.number)}.pdf"`);
    renderInvoicePDF(invoice, logoBuffer).pipe(res);
  } catch (err) {
    next(err);
  }
});
