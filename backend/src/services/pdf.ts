import PDFDocument from "pdfkit";
import { Readable } from "node:stream";
import type { Prisma } from "@prisma/client";

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: { client: true; items: true; user: true };
}>;

const PRIMARY = "#2563eb";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

const fmt = (n: number | string | { toString(): string }) => {
  const v = typeof n === "number" ? n : Number(n.toString());
  return new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-PT", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export function renderInvoicePDF(invoice: InvoiceWithRelations): Readable {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const { user, client, items } = invoice;

  // Header
  doc
    .fillColor(TEXT)
    .fontSize(24)
    .font("Helvetica-Bold")
    .text(user.companyName ?? "BillFlow", 50, 50);

  if (user.companyAddress) {
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(MUTED)
      .text(user.companyAddress, 50, 78, { width: 250 });
  }
  if (user.companyVat) doc.text(`NIF: ${user.companyVat}`);
  if (user.companyEmail) doc.text(user.companyEmail);
  if (user.companyPhone) doc.text(user.companyPhone);

  // Invoice meta (right side)
  doc
    .fillColor(PRIMARY)
    .fontSize(28)
    .font("Helvetica-Bold")
    .text("FATURA", 350, 50, { align: "right", width: 195 });

  doc
    .fontSize(10)
    .fillColor(TEXT)
    .font("Helvetica-Bold")
    .text(invoice.number, 350, 85, { align: "right", width: 195 });

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(MUTED)
    .text(`Emitida: ${fmtDate(invoice.dateIssued)}`, 350, 102, { align: "right", width: 195 })
    .text(`Vencimento: ${fmtDate(invoice.dueDate)}`, 350, 116, { align: "right", width: 195 });

  // Status pill
  const statusLabel = { PENDING: "PENDENTE", PAID: "PAGA", OVERDUE: "VENCIDA" }[invoice.status];
  const statusColor = { PENDING: "#eab308", PAID: "#16a34a", OVERDUE: "#dc2626" }[invoice.status];
  doc
    .roundedRect(465, 132, 80, 18, 4)
    .fill(statusColor)
    .fillColor("#ffffff")
    .fontSize(9)
    .font("Helvetica-Bold")
    .text(statusLabel, 465, 137, { align: "center", width: 80 });

  // Bill-to
  doc
    .fillColor(MUTED)
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("FATURAR PARA", 50, 175);

  doc
    .fillColor(TEXT)
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(client.name, 50, 188);

  doc.fontSize(9).font("Helvetica").fillColor(MUTED);
  if (client.address) doc.text(client.address, 50, 204, { width: 250 });
  if (client.email) doc.text(client.email);
  if (client.phone) doc.text(client.phone);

  // Items table
  const tableTop = 280;
  doc
    .moveTo(50, tableTop)
    .lineTo(545, tableTop)
    .strokeColor(LINE)
    .lineWidth(1)
    .stroke();

  doc
    .fillColor(MUTED)
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("DESCRIÇÃO", 50, tableTop + 8)
    .text("QTD", 350, tableTop + 8, { width: 50, align: "right" })
    .text("PREÇO", 405, tableTop + 8, { width: 60, align: "right" })
    .text("TOTAL", 470, tableTop + 8, { width: 75, align: "right" });

  doc
    .moveTo(50, tableTop + 24)
    .lineTo(545, tableTop + 24)
    .strokeColor(LINE)
    .stroke();

  let y = tableTop + 32;
  doc.fillColor(TEXT).fontSize(9.5).font("Helvetica");

  for (const item of items) {
    const lineTotal = Number(item.price) * item.quantity;
    doc
      .text(item.description, 50, y, { width: 290 })
      .text(item.quantity.toString(), 350, y, { width: 50, align: "right" })
      .text(fmt(item.price), 405, y, { width: 60, align: "right" })
      .text(fmt(lineTotal), 470, y, { width: 75, align: "right" });

    const heights = [
      doc.heightOfString(item.description, { width: 290 }),
      14,
    ];
    y += Math.max(...heights) + 8;

    doc
      .moveTo(50, y - 4)
      .lineTo(545, y - 4)
      .strokeColor(LINE)
      .stroke();
  }

  // Totals
  const totalsX = 380;
  const totalsW = 165;
  let ty = y + 12;

  const row = (label: string, value: string, bold = false) => {
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fillColor(bold ? TEXT : MUTED)
      .fontSize(bold ? 11 : 9.5)
      .text(label, totalsX, ty, { width: 90 })
      .fillColor(TEXT)
      .text(value, totalsX + 90, ty, { width: 75, align: "right" });
    ty += bold ? 18 : 16;
  };

  row("Subtotal", fmt(invoice.subtotal));

  const discountValue = Number(invoice.discountValue);
  if (invoice.discountType !== "NONE" && discountValue > 0) {
    const subtotal = Number(invoice.subtotal);
    const dAmt = invoice.discountType === "PERCENT" ? (subtotal * discountValue) / 100 : discountValue;
    const lbl = invoice.discountType === "PERCENT" ? `Desconto (${discountValue}%)` : "Desconto";
    row(lbl, `-${fmt(dAmt)}`);
  }

  if (Number(invoice.taxRate) > 0) {
    row(`IVA (${invoice.taxRate}%)`, fmt(invoice.taxAmount));
  }

  doc
    .moveTo(totalsX, ty)
    .lineTo(totalsX + totalsW, ty)
    .strokeColor(LINE)
    .stroke();
  ty += 8;

  row("Total", fmt(invoice.total), true);

  // Notes
  if (invoice.notes) {
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("NOTAS", 50, ty + 20);
    doc
      .fillColor(TEXT)
      .fontSize(9)
      .font("Helvetica")
      .text(invoice.notes, 50, ty + 32, { width: 300 });
  }

  // Footer
  doc
    .fillColor(MUTED)
    .fontSize(8)
    .font("Helvetica")
    .text(
      `Fatura gerada em ${fmtDate(new Date())} · BillFlow`,
      50,
      doc.page.height - 60,
      { align: "center", width: 495 }
    );

  doc.end();
  return doc as unknown as Readable;
}
