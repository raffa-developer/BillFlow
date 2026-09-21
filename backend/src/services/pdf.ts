import PDFDocument from "pdfkit";
import { Readable } from "node:stream";
import { discountAmountFor } from "../utils/invoiceMath";

interface InvoiceItem {
  id: number; invoiceId: number; productId: number | null;
  description: string; quantity: number; price: number;
}
interface InvoiceClient {
  id: number; name: string; email: string | null;
  phone: string | null; address: string | null;
}
interface InvoiceUser {
  id: number; email: string; companyName: string | null;
  companyAddress: string | null; companyVat: string | null;
  companyEmail: string | null; companyPhone: string | null;
  companyLogoUrl: string | null;
}
interface InvoiceWithRelations {
  id: number; number: string; status: string;
  dateIssued: Date; dueDate: Date;
  subtotal: number; discountType: string; discountValue: number;
  taxRate: number; taxAmount: number; total: number;
  notes: string | null; publicToken: string | null;
  client: InvoiceClient; user: InvoiceUser; items: InvoiceItem[];
}

const PRIMARY = "#2563eb";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

const fmt = (n: number | string | { toString(): string }) => {
  const v = typeof n === "number" ? n : Number(n.toString());
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export function renderInvoicePDF(invoice: InvoiceWithRelations, logoBuffer?: Buffer | null): Readable {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const { user, client, items } = invoice;

  // Header — logo or company name
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 50, { fit: [120, 45] });
    } catch {
      // logo render failed, fall through to text
    }
    doc
      .fillColor(TEXT)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(user.companyName ?? "BillFlow", 50, 100);
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(MUTED);
    if (user.companyAddress) doc.text(user.companyAddress, 50, 115, { width: 250 });
  } else {
    doc
      .fillColor(TEXT)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(user.companyName ?? "BillFlow", 50, 50);
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(MUTED);
    if (user.companyAddress) doc.text(user.companyAddress, 50, 78, { width: 250 });
  }

  if (user.companyVat) doc.text(`VAT No.: ${user.companyVat}`);
  if (user.companyEmail) doc.text(user.companyEmail);
  if (user.companyPhone) doc.text(user.companyPhone);

  // Invoice meta (right side)
  doc
    .fillColor(PRIMARY)
    .fontSize(28)
    .font("Helvetica-Bold")
    .text("INVOICE", 350, 50, { align: "right", width: 195 });

  doc
    .fontSize(10)
    .fillColor(TEXT)
    .font("Helvetica-Bold")
    .text(invoice.number, 350, 85, { align: "right", width: 195 });

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(MUTED)
    .text(`Issued: ${fmtDate(invoice.dateIssued)}`, 350, 102, { align: "right", width: 195 })
    .text(`Due: ${fmtDate(invoice.dueDate)}`, 350, 116, { align: "right", width: 195 });

  // Status pill
  const statusLabel = ({ PENDING: "PENDING", PAID: "PAID", OVERDUE: "OVERDUE" } as Record<string, string>)[invoice.status] ?? invoice.status;
  const statusColor = ({ PENDING: "#eab308", PAID: "#16a34a", OVERDUE: "#dc2626" } as Record<string, string>)[invoice.status] ?? "#64748b";
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
    .text("BILL TO", 50, 175);

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
    .text("DESCRIPTION", 50, tableTop + 8)
    .text("QTY", 350, tableTop + 8, { width: 50, align: "right" })
    .text("PRICE", 405, tableTop + 8, { width: 60, align: "right" })
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
    const dAmt = discountAmountFor(subtotal, invoice.discountType as "PERCENT" | "FIXED", discountValue);
    const lbl = invoice.discountType === "PERCENT" ? `Discount (${discountValue}%)` : "Discount";
    row(lbl, `-${fmt(dAmt)}`);
  }

  if (Number(invoice.taxRate) > 0) {
    row(`Tax (${invoice.taxRate}%)`, fmt(invoice.taxAmount));
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
      .text("NOTES", 50, ty + 20);
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
      `Invoice generated on ${fmtDate(new Date())} · BillFlow`,
      50,
      doc.page.height - 60,
      { align: "center", width: 495 }
    );

  doc.end();
  return doc as unknown as Readable;
}
