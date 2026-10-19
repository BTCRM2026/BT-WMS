import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Report } from "./reports";

const safe = (s: unknown) => String(s ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
/** Spreadsheet formula injection guard for text cells. */
const cell = (v: unknown) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v);

export async function toXlsx(reports: Report[], meta: { company: string; period?: string }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BT Warehouse";
  for (const r of reports) {
    const ws = wb.addWorksheet(r.title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
    ws.addRow([`${meta.company} · ${r.title}${meta.period ? ` · ${meta.period}` : ""}`]).font = {
      bold: true,
      size: 13,
    };
    ws.addRow([]);
    const head = ws.addRow(r.columns.map((c) => c.header));
    head.font = { bold: true };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEFC" } };
    for (const row of r.rows) ws.addRow(r.columns.map((c) => cell(row[c.key])));
    if (r.totals)
      ws.addRow(r.columns.map((c, i) => (i === 0 ? "Total" : (r.totals![c.key] ?? null)))).font = { bold: true };
    r.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.min(
        48,
        Math.max(10, c.header.length + 2, ...r.rows.slice(0, 200).map((x) => String(x[c.key] ?? "").length + 2)),
      );
      if (c.kind === "money") col.numFmt = "#,##0.00";
    });
    ws.views = [{ state: "frozen", ySplit: 3 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function toPdf(r: Report, meta: { company: string; period?: string }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${meta.company} - ${r.title}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842;
  const H = 595; // A4 landscape
  const margin = 32;
  const widths = r.columns.map((c) => (c.kind === "number" || c.kind === "money" || c.kind === "date" ? 1 : 2.4));
  const scale = (W - margin * 2) / widths.reduce((a, b) => a + b, 0);
  const xs = widths.reduce<number[]>((acc, w, i) => [...acc, i ? acc[i - 1] + widths[i - 1] * scale : margin], []);
  const fit = (s: string, w: number, f = font) => {
    let t = safe(s);
    while (t.length > 1 && f.widthOfTextAtSize(t, 8) > w - 4) t = t.slice(0, -2) + "…".replace("…", ".");
    return t;
  };

  let page = pdf.addPage([W, H]);
  let y = H - margin;
  const header = () => {
    page.drawText(safe(`${meta.company} · ${r.title}`), { x: margin, y, size: 13, font: bold });
    y -= 16;
    if (meta.period) page.drawText(safe(meta.period), { x: margin, y, size: 9, font, color: rgb(0.32, 0.38, 0.46) });
    y -= 18;
    r.columns.forEach((c, i) =>
      page.drawText(fit(c.header, widths[i] * scale, bold), { x: xs[i], y, size: 8, font: bold }),
    );
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.5, color: rgb(0.7, 0.72, 0.76) });
    y -= 12;
  };
  header();
  const rows = [
    ...r.rows,
    ...(r.totals
      ? [{ ...Object.fromEntries(r.columns.map((c) => [c.key, ""])), [r.columns[0].key]: "Total", ...r.totals }]
      : []),
  ];
  for (const row of rows) {
    if (y < margin + 12) {
      page = pdf.addPage([W, H]);
      y = H - margin;
      header();
    }
    r.columns.forEach((c, i) => {
      const v = row[c.key];
      const s = typeof v === "number" ? (c.kind === "money" ? v.toFixed(2) : String(v)) : String(v ?? "");
      page.drawText(fit(s, widths[i] * scale), {
        x: xs[i],
        y,
        size: 8,
        font: row === rows.at(-1) && r.totals ? bold : font,
      });
    });
    y -= 12;
  }
  pdf
    .getPages()
    .forEach((p, i, all) => p.drawText(`Page ${i + 1} of ${all.length}`, { x: W - margin - 60, y: 16, size: 8, font }));
  return Buffer.from(await pdf.save());
}
