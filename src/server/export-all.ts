import ExcelJS from "exceljs";
import type { Context } from "@/server/auth/context";

const TABLES = [
  "product",
  "batch",
  "location",
  "stockMovement",
  "purchaseOrder",
  "purchaseOrderLine",
  "inwardReceipt",
  "inwardReceiptLine",
  "salesOrder",
  "salesOrderLine",
  "pickList",
  "pickListLine",
  "dispatch",
  "dispatchLine",
  "stockReturn",
  "damage",
  "stockAudit",
  "stockAuditLine",
  "adjustment",
  "auditLog",
] as const;

const value = (v: unknown) =>
  v == null
    ? null
    : v instanceof Date
      ? v.toISOString()
      : typeof v === "object"
        ? JSON.stringify(v)
        : typeof v === "string" && /^[=+\-@]/.test(v)
          ? `'${v}`
          : v;

/** Full data export for one company (tenant-scoped reads), plus users without password hashes. */
export async function exportCompany(ctx: Context) {
  const wb = new ExcelJS.Workbook();
  for (const t of TABLES) {
    const rows =
      (await (ctx.db[t] as unknown as { findMany: (a: object) => Promise<Record<string, unknown>[]> }).findMany({
        take: 200_000,
      })) ?? [];
    const ws = wb.addWorksheet(t);
    const cols = rows[0] ? Object.keys(rows[0]) : ["(empty)"];
    ws.addRow(cols).font = { bold: true };
    for (const r of rows) ws.addRow(cols.map((c) => value(r[c])));
  }
  const users = await ctx.db.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  const ws = wb.addWorksheet("users");
  ws.addRow(["id", "name", "email", "role", "isActive", "createdAt"]).font = { bold: true };
  for (const u of users) ws.addRow([u.id, u.name, u.email, u.role, u.isActive, u.createdAt.toISOString()]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
