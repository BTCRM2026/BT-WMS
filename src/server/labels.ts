import bwipjs from "bwip-js/node";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Context } from "@/server/auth/context";

export type LabelKind = "product" | "batch" | "tile" | "carton";
export type LabelLayout = "a4" | "50x25";
const MM = 72 / 25.4;
const safe = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

type Label = { code: string; title: string; sub: string };

/** What goes on each label. Carton labels carry SKU|batch|pack size for one-scan receiving. */
async function loadLabels(ctx: Context, kind: LabelKind, ids: string[]): Promise<Label[]> {
  if (kind === "tile") {
    const tiles = await ctx.db.location.findMany({ where: { id: { in: ids } }, orderBy: { code: "asc" } });
    return tiles.map((t) => ({ code: t.code, title: t.code, sub: `${ctx.company.name} · ${t.type.toLowerCase()}` }));
  }
  if (kind === "product") {
    const ps = await ctx.db.product.findMany({ where: { id: { in: ids } }, orderBy: { sku: "asc" } });
    return ps.map((p) => ({ code: p.barcode || p.sku, title: p.sku, sub: p.name }));
  }
  const bs = await ctx.db.batch.findMany({
    where: { id: { in: ids } },
    include: { product: true },
    orderBy: { batchNo: "asc" },
  });
  return bs.map((b) => ({
    code: kind === "carton" ? `${b.product.sku}|${b.batchNo}|${b.product.packSize}` : b.batchNo,
    title: kind === "carton" ? `${b.product.sku} × ${b.product.packSize}` : `${b.product.sku} · ${b.batchNo}`,
    sub: `${b.product.name}${b.expiryDate ? ` · EXP ${b.expiryDate.toISOString().slice(0, 7)}` : ""}`,
  }));
}

const barcode = (text: string, qr: boolean) =>
  bwipjs.toBuffer({
    bcid: qr ? "qrcode" : "code128",
    text,
    scale: 3,
    height: qr ? undefined : 10,
    includetext: false,
    paddingwidth: 2,
    paddingheight: 2,
  });

/**
 * Printable labels: A4 sheets (3 × 8, 70 × 37 mm) or one label per page for
 * 50 × 25 mm label printers. Tiles and cartons default to QR, products/batches to Code 128.
 */
export async function labelsPdf(
  ctx: Context,
  kind: LabelKind,
  ids: string[],
  layout: LabelLayout,
  symbology?: "qr" | "barcode",
) {
  const labels = await loadLabels(ctx, kind, ids.slice(0, 1000));
  const qr = (symbology ?? (kind === "tile" || kind === "carton" ? "qr" : "barcode")) === "qr";
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${kind} labels`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const box = layout === "a4" ? { w: 70 * MM, h: 37 * MM } : { w: 50 * MM, h: 25 * MM };
  const perPage = layout === "a4" ? 24 : 1;
  const pageSize: [number, number] = layout === "a4" ? [210 * MM, 297 * MM] : [box.w, box.h];
  const top = layout === "a4" ? (297 * MM - 8 * box.h) / 2 : 0;

  let page = pdf.addPage(pageSize);
  for (const [i, l] of labels.entries()) {
    if (i && i % perPage === 0) page = pdf.addPage(pageSize);
    const slot = i % perPage;
    const x = (slot % 3) * box.w;
    const y = pageSize[1] - top - (Math.floor(slot / 3) + 1) * box.h;
    const img = await pdf.embedPng(await barcode(l.code, qr));
    const pad = 2.5 * MM;
    const imgH = box.h - pad * 2 - (qr ? 0 : 9);
    const imgW = qr ? imgH : Math.min(box.w - pad * 2, (img.width / img.height) * imgH);
    page.drawImage(img, { x: x + pad, y: y + box.h - pad - imgH, width: imgW, height: imgH });
    const tx = qr ? x + pad * 2 + imgW : x + pad;
    const maxW = x + box.w - pad - tx;
    const fit = (s: string, size: number, f = font) => {
      let t = safe(s);
      while (t.length > 3 && f.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
      return t;
    };
    const size = layout === "a4" ? 11 : 9;
    if (qr) {
      page.drawText(fit(l.title, size, bold), { x: tx, y: y + box.h - pad - size, size, font: bold });
      page.drawText(fit(l.sub, 7), {
        x: tx,
        y: y + box.h - pad - size - 11,
        size: 7,
        font,
        color: rgb(0.25, 0.3, 0.38),
      });
      page.drawText(fit(l.code, 6), { x: tx, y: y + pad, size: 6, font });
    } else {
      page.drawText(fit(`${l.title}  ${l.sub}`, 7, bold), { x: tx, y: y + pad, size: 7, font: bold });
    }
  }
  if (!labels.length) page.drawText("No labels selected", { x: 20, y: pageSize[1] - 30, size: 10, font });
  return Buffer.from(await pdf.save());
}
