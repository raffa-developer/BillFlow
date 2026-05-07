import { Router } from "express";
import { prisma } from "../db/prisma";
import { AppError } from "../utils/errors";
import { renderInvoicePDF } from "../services/pdf";

export const publicInvoicesRouter = Router();

// GET /api/public/invoices/:token — fetch invoice (no auth)
publicInvoicesRouter.get("/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { publicToken: token },
      include: {
        client: { select: { name: true, email: true, address: true } },
        items: true,
        user: {
          select: {
            companyName: true,
            companyAddress: true,
            companyVat: true,
            companyEmail: true,
            companyPhone: true,
            companyLogoUrl: true,
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

// GET /api/public/invoices/:token/pdf — stream PDF
publicInvoicesRouter.get("/:token/pdf", async (req, res, next) => {
  try {
    const { token } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { publicToken: token },
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
