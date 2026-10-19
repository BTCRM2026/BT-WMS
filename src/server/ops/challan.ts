import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { HttpError, type Context } from "@/server/auth/context";

// Standard PDF fonts only cover Latin-1: keep text to that range.
const safe = (s: string | null | undefined) => (s ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "-");

/** Delivery challan (A4) for one dispatch. */
export async function challanPdf(ctx: Context, dispatchId: string) {
  const d = await ctx.db.dispatch.findUnique({
    where: { id: dispatchId },
    include: { salesOrder: true, lines: { include: { product: true, batch: true } } },
  });
  if (!d) throw new HttpError(404, "Not found");

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Delivery challan ${d.dispatchNumber}`);
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const text = (s: string, x: number, size = 10, f = font) =>
    page.drawText(safe(s), { x, y, size, font: f, color: rgb(0.06, 0.09, 0.16) });
  const line = () =>
    page.drawLine({
      start: { x: 40, y: y - 6 },
      end: { x: 555, y: y - 6 },
      thickness: 0.5,
      color: rgb(0.7, 0.72, 0.76),
    });

  text(ctx.company.name, 40, 18, bold);
  text("DELIVERY CHALLAN", 400, 14, bold);
  y -= 22;
  text("Main Warehouse", 40);
  text(`No. ${d.dispatchNumber}`, 400);
  y -= 14;
  text(`Date: ${day(d.dispatchedAt)}`, 400);
  if (d.status === "CANCELLED") {
    y -= 14;
    text("CANCELLED", 400, 12, bold);
  }
  y -= 26;
  text("Deliver to:", 40, 10, bold);
  text(`Order: ${d.salesOrder.orderNumber}`, 300);
  y -= 14;
  text(d.salesOrder.customerName, 40);
  text(`Vehicle: ${d.vehicleNo ?? "-"}`, 300);
  y -= 14;
  text(`LR no.: ${d.lrNumber ?? "-"}`, 300);
  y -= 14;
  text(`Transporter: ${d.transporter ?? "-"}`, 300);
  y -= 28;

  const cols = [40, 60, 140, 360, 440, 510];
  ["#", "SKU", "Product", "Batch", "Expiry", "Qty"].forEach((h, i) => text(h, cols[i], 9, bold));
  line();
  y -= 18;
  let total = 0;
  d.lines.forEach((l, i) => {
    if (y < 120) {
      // ponytail: one page fits ~30 lines; add page breaks if a single challan ever exceeds that.
      return;
    }
    text(String(i + 1), cols[0], 9);
    text(l.product.sku, cols[1], 9);
    text(l.product.name.slice(0, 44), cols[2], 9);
    text(l.batch?.batchNo ?? "-", cols[3], 9);
    text(day(l.batch?.expiryDate ?? null), cols[4], 9);
    text(String(l.quantity), cols[5], 9);
    total += l.quantity;
    y -= 16;
  });
  line();
  y -= 18;
  text("Total units", cols[2], 10, bold);
  text(String(total), cols[5], 10, bold);

  y = 90;
  text("Packed by", 40);
  text("Driver", 240);
  text("Received by", 430);
  y -= 30;
  text("____________________", 40);
  text("____________________", 240);
  text("____________________", 430);

  return { bytes: await pdf.save(), fileName: `${d.dispatchNumber}.pdf` };
}
