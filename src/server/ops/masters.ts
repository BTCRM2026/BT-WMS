import ExcelJS from "exceljs";
import { z } from "zod";
import type { LocationType, Role } from "@prisma/client";
import { HttpError, type Context } from "@/server/auth/context";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db/client";
import { hashPassword, validatePassword } from "@/server/auth/password";
import { expandRows, formatTileCode, parseTileCode, rowNumber, zoneBelongsTo } from "@/lib/tile";
import { once, scopeOf } from "./core";

// ------------------------------------------------------------------ products

/** SKU rule: 3-32 chars, upper-case letters, digits and dashes, starting with a letter or digit. */
export const SKU_RE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

const money = z.coerce.number().min(0, "Cannot be negative").max(10_000_000).multipleOf(0.01, "At most 2 decimals");
export const productSchema = z
  .object({
    sku: z.string().trim().toUpperCase().regex(SKU_RE, "SKU: 3-32 characters, A-Z, 0-9 and dashes"),
    name: z.string().trim().min(2, "Name is too short").max(120),
    unit: z.string().trim().toUpperCase().min(1).max(10).default("PCS"),
    packSize: z.coerce.number().int("Whole number").min(1, "At least 1").max(10_000).default(1),
    barcode: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z-]{4,40}$/, "Barcode: 4-40 letters/digits")
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    minStock: z.coerce.number().int("Whole number").min(0).max(10_000_000).default(0),
    maxStock: z.coerce.number().int("Whole number").min(0).max(10_000_000).optional().nullable(),
    expiryTracked: z.coerce.boolean().default(false),
    defaultTileCode: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    mrp: money.default(0),
    purchasePrice: money.default(0),
  })
  .refine((p) => p.maxStock == null || p.maxStock >= p.minStock, {
    message: "Max stock must be at least min stock",
    path: ["maxStock"],
  });

async function resolveTile(ctx: Context, code: string | null | undefined) {
  if (!code) return null;
  const t = await ctx.db.location.findFirst({ where: { code } });
  if (!t || t.type !== "STORAGE") throw new HttpError(400, `Default tile ${code} is not one of your storage tiles.`);
  return t.id;
}

export async function saveProduct(
  ctx: Context,
  input: { key?: string; id?: string; data: z.input<typeof productSchema> },
) {
  const v = productSchema.parse(input.data);
  const defaultLocationId = await resolveTile(ctx, v.defaultTileCode);
  const data = {
    sku: v.sku,
    name: v.name,
    unit: v.unit,
    packSize: v.packSize,
    barcode: v.barcode ?? null,
    minStock: v.minStock,
    maxStock: v.maxStock ?? null,
    expiryTracked: v.expiryTracked,
    defaultLocationId,
    mrp: v.mrp,
    purchasePrice: v.purchasePrice,
  };
  return once(ctx, input.key, "product.save", async (tx) => {
    const clash = await tx.product.findFirst({
      where: {
        id: input.id ? { not: input.id } : undefined,
        OR: [{ sku: v.sku }, ...(v.barcode ? [{ barcode: v.barcode }] : [])],
      },
    });
    if (clash)
      throw new HttpError(
        409,
        clash.sku === v.sku ? `SKU ${v.sku} already exists.` : `Barcode ${v.barcode} is already used by ${clash.sku}.`,
      );
    if (input.id) {
      const before = await tx.product.findUnique({ where: { id: input.id } });
      if (!before) throw new HttpError(404, "Product not found.");
      const p = await tx.product.update({ where: { id: input.id }, data });
      await audit(
        { ...ctx.auditMeta, action: "product.update", entity: "product", entityId: p.id, before, after: p },
        tx,
      );
      return { id: p.id };
    }
    const p = await tx.product.create({ data: { ...scopeOf(ctx), ...data } });
    await audit({ ...ctx.auditMeta, action: "product.create", entity: "product", entityId: p.id, after: p }, tx);
    return { id: p.id };
  });
}

export async function setProductActive(ctx: Context, id: string, isActive: boolean) {
  const before = await ctx.db.product.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "Product not found.");
  const p = await ctx.db.product.update({ where: { id }, data: { isActive } });
  await audit({
    ...ctx.auditMeta,
    action: isActive ? "product.activate" : "product.deactivate",
    entity: "product",
    entityId: id,
    before,
    after: p,
  });
  return { id };
}

// ------------------------------------------------------------------ product import (CSV / Excel)

export const IMPORT_COLUMNS = [
  "sku",
  "name",
  "unit",
  "pack_size",
  "barcode",
  "min_stock",
  "max_stock",
  "expiry_tracked",
  "default_tile",
  "mrp",
  "purchase_price",
] as const;
const REQUIRED = ["sku", "name"] as const;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

/** Tiny RFC 4180 CSV reader (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') ((cell += '"'), i++);
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") (row.push(cell), (cell = ""));
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      (row.push(cell), rows.push(row), (row = []), (cell = ""));
    } else cell += ch;
  }
  if (cell || row.length) (row.push(cell), rows.push(row));
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

async function readSheet(name: string, bytes: Buffer): Promise<string[][]> {
  if (bytes.length > MAX_IMPORT_BYTES) throw new HttpError(413, "File is larger than 2 MB.");
  const isXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b; // zip signature
  if (/\.xlsx$/i.test(name) && isXlsx) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(bytes as unknown as ArrayBuffer);
    } catch {
      throw new HttpError(400, "Could not read this Excel file. Save it as .xlsx and try again.");
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new HttpError(400, "The Excel file has no sheets.");
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals = (r.values as ExcelJS.CellValue[]).slice(1);
      rows.push(
        vals.map((c) =>
          c == null
            ? ""
            : typeof c === "object" && "text" in c
              ? String(c.text)
              : typeof c === "object" && "result" in c
                ? String(c.result ?? "")
                : String(c),
        ),
      );
    });
    return rows;
  }
  if (/\.csv$/i.test(name) && !isXlsx) return parseCsv(bytes.toString("utf8"));
  throw new HttpError(415, "Upload a .csv or .xlsx file.");
}

const header = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
const yesNo = (s: string) => /^(1|y|yes|true)$/i.test(s.trim());

export type ImportRow = { row: number; sku: string; action: "create" | "update"; errors: string[] };

/** Validate every row; returns a preview. Nothing is written unless commit=true AND there are no errors. */
export async function importProducts(ctx: Context, file: { name: string; bytes: Buffer }, commit: boolean) {
  const sheet = await readSheet(file.name, file.bytes);
  if (sheet.length < 2) throw new HttpError(400, "The file has no data rows.");
  const cols = sheet[0].map(header);
  const missing = REQUIRED.filter((c) => !cols.includes(c));
  if (missing.length)
    throw new HttpError(400, `Missing column(s): ${missing.join(", ")}. Expected: ${IMPORT_COLUMNS.join(", ")}.`);
  const unknown = cols.filter((c) => c && !(IMPORT_COLUMNS as readonly string[]).includes(c));
  if (sheet.length - 1 > MAX_ROWS) throw new HttpError(400, `At most ${MAX_ROWS} rows per file.`);

  const [existing, tiles] = await Promise.all([
    ctx.db.product.findMany({ select: { id: true, sku: true, barcode: true } }),
    ctx.db.location.findMany({ where: { type: "STORAGE" }, select: { id: true, code: true } }),
  ]);
  const bySku = new Map(existing.map((p) => [p.sku, p]));
  const tileByCode = new Map(tiles.map((t) => [t.code, t.id]));
  const seenSku = new Map<string, number>();
  const seenBarcode = new Map<string, number>();

  const rows: (ImportRow & { data?: z.output<typeof productSchema> })[] = [];
  for (let i = 1; i < sheet.length; i++) {
    const raw = Object.fromEntries(cols.map((c, j) => [c, (sheet[i][j] ?? "").trim()]));
    const errors: string[] = [];
    const parsed = productSchema.safeParse({
      sku: raw.sku,
      name: raw.name,
      unit: raw.unit || undefined,
      packSize: raw.pack_size || undefined,
      barcode: raw.barcode || null,
      minStock: raw.min_stock || undefined,
      maxStock: raw.max_stock || null,
      expiryTracked: raw.expiry_tracked ? yesNo(raw.expiry_tracked) : undefined,
      defaultTileCode: raw.default_tile || null,
      mrp: raw.mrp || undefined,
      purchasePrice: raw.purchase_price || undefined,
    });
    if (!parsed.success)
      for (const iss of parsed.error.issues) errors.push(`${String(iss.path[0] ?? "row")}: ${iss.message}`);
    const sku = (raw.sku ?? "").toUpperCase();
    if (sku) {
      if (seenSku.has(sku)) errors.push(`sku: duplicate of row ${seenSku.get(sku)}`);
      else seenSku.set(sku, i + 1);
    }
    const bc = raw.barcode;
    if (bc) {
      if (seenBarcode.has(bc)) errors.push(`barcode: duplicate of row ${seenBarcode.get(bc)}`);
      else seenBarcode.set(bc, i + 1);
      const owner = existing.find((p) => p.barcode === bc);
      if (owner && owner.sku !== sku) errors.push(`barcode: already used by ${owner.sku}`);
    }
    if (raw.default_tile && !tileByCode.has(raw.default_tile.toUpperCase()))
      errors.push(`default_tile: ${raw.default_tile} is not one of your storage tiles`);
    rows.push({
      row: i + 1,
      sku,
      action: bySku.has(sku) ? "update" : "create",
      errors,
      data: parsed.success ? parsed.data : undefined,
    });
  }

  const summary = {
    total: rows.length,
    valid: rows.filter((r) => !r.errors.length).length,
    invalid: rows.filter((r) => r.errors.length).length,
    create: rows.filter((r) => !r.errors.length && r.action === "create").length,
    update: rows.filter((r) => !r.errors.length && r.action === "update").length,
    ignoredColumns: unknown,
  };
  const report = rows.map(({ row, sku, action, errors }) => ({ row, sku, action, errors }));
  if (!commit) return { committed: false, summary, rows: report };
  if (summary.invalid)
    throw new HttpError(400, `Fix the ${summary.invalid} row(s) with errors first; nothing was imported.`);

  await ctx.db.$transaction(
    async (tx) => {
      for (const r of rows) {
        const d = r.data!;
        const data = {
          sku: d.sku,
          name: d.name,
          unit: d.unit,
          packSize: d.packSize,
          barcode: d.barcode ?? null,
          minStock: d.minStock,
          maxStock: d.maxStock ?? null,
          expiryTracked: d.expiryTracked,
          defaultLocationId: d.defaultTileCode ? tileByCode.get(d.defaultTileCode)! : null,
          mrp: d.mrp,
          purchasePrice: d.purchasePrice,
        };
        const ex = bySku.get(d.sku);
        if (ex) await tx.product.update({ where: { id: ex.id }, data });
        else await tx.product.create({ data: { ...scopeOf(ctx), ...data } });
      }
      await audit(
        { ...ctx.auditMeta, action: "product.import", entity: "product", after: { file: file.name, ...summary } },
        tx,
      );
    },
    { timeout: 60_000 },
  );
  return { committed: true, summary, rows: report };
}

// ------------------------------------------------------------------ tiles

const TYPES = ["STORAGE", "RECEIVING", "DISPATCH", "DAMAGED", "QUARANTINE", "RETURN"] as const;

export const tileSchema = z.object({
  code: z.string().trim().toUpperCase(),
  type: z.enum(TYPES).default("STORAGE"),
  capacity: z.coerce.number().int().min(1).max(1_000_000).optional().nullable(),
});

export async function saveTile(ctx: Context, input: { key?: string; id?: string; data: z.input<typeof tileSchema> }) {
  const v = tileSchema.parse(input.data);
  const p = parseTileCode(v.code);
  if (!p) throw new HttpError(400, `"${v.code}" is not a valid tile code (example: ${ctx.company.code}-A-03-1).`);
  if (!zoneBelongsTo(p.zone, ctx.company.code))
    throw new HttpError(400, `Zone ${p.zone} must start with ${ctx.company.code}.`);
  return once(ctx, input.key, "tile.save", async (tx) => {
    const data = {
      code: v.code,
      zone: p.zone,
      row: rowNumber(p.row),
      column: p.column,
      level: p.level,
      type: v.type as LocationType,
      capacity: v.capacity ?? null,
    };
    // Codes are unique per warehouse across companies: check globally for a clear message.
    const taken = await prisma.location.findFirst({
      where: { warehouseId: ctx.warehouseId!, code: v.code, id: input.id ? { not: input.id } : undefined },
    });
    if (taken) throw new HttpError(409, `Tile ${v.code} already exists.`);
    if (input.id) {
      const before = await tx.location.findUnique({ where: { id: input.id } });
      if (!before) throw new HttpError(404, "Tile not found.");
      const moved = before.code !== v.code && (await tx.stockBalance.count({ where: { locationId: before.id } })) > 0;
      if (moved) throw new HttpError(400, "Move the stock off this tile before renaming it.");
      const t = await tx.location.update({ where: { id: input.id }, data });
      await audit(
        { ...ctx.auditMeta, action: "tile.update", entity: "location", entityId: t.id, before, after: t },
        tx,
      );
      return { id: t.id };
    }
    const t = await tx.location.create({ data: { ...scopeOf(ctx), ...data } });
    await audit({ ...ctx.auditMeta, action: "tile.create", entity: "location", entityId: t.id, after: t }, tx);
    return { id: t.id };
  });
}

export const bulkTilesSchema = z.object({
  key: z.string().max(64).optional(),
  zone: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,4}$/, "Zone: 2-4 letters/digits"),
  rows: z.string().trim().min(1, "Rows, e.g. A-F"),
  columnFrom: z.coerce.number().int().min(1).max(99),
  columnTo: z.coerce.number().int().min(1).max(99),
  levelFrom: z.coerce.number().int().min(1).max(99).default(1),
  levelTo: z.coerce.number().int().min(1).max(99).default(1),
  type: z.enum(TYPES).default("STORAGE"),
  capacity: z.coerce.number().int().min(1).max(1_000_000).optional().nullable(),
});

/** Bulk-generate tiles, e.g. zone BT, rows A-F, columns 1-20, levels 1-3 = 360 tiles. Existing codes are skipped. */
export async function generateTiles(ctx: Context, input: z.input<typeof bulkTilesSchema>) {
  const v = bulkTilesSchema.parse(input);
  if (!zoneBelongsTo(v.zone, ctx.company.code)) throw new HttpError(400, `Zone must start with ${ctx.company.code}.`);
  if (v.columnTo < v.columnFrom || v.levelTo < v.levelFrom)
    throw new HttpError(400, "Ranges must go from low to high.");
  let rows: string[];
  try {
    rows = expandRows(v.rows);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  const codes: { code: string; row: string; column: number; level: number }[] = [];
  for (const row of rows)
    for (let column = v.columnFrom; column <= v.columnTo; column++)
      for (let level = v.levelFrom; level <= v.levelTo; level++)
        codes.push({ code: formatTileCode({ zone: v.zone, row, column, level }), row, column, level });
  if (codes.length > 5000) throw new HttpError(400, `That is ${codes.length} tiles; generate at most 5000 at a time.`);

  return once(ctx, v.key, "tile.bulk", async (tx) => {
    const taken = new Set(
      (
        await prisma.location.findMany({
          where: { warehouseId: ctx.warehouseId!, code: { in: codes.map((c) => c.code) } },
          select: { code: true },
        })
      ).map((t) => t.code),
    );
    const fresh = codes.filter((c) => !taken.has(c.code));
    await tx.location.createMany({
      data: fresh.map((c) => ({
        ...scopeOf(ctx),
        code: c.code,
        zone: v.zone,
        row: rowNumber(c.row),
        column: c.column,
        level: c.level,
        type: v.type,
        capacity: v.capacity ?? null,
      })),
    });
    await audit(
      {
        ...ctx.auditMeta,
        action: "tile.bulk",
        entity: "location",
        after: { ...v, created: fresh.length, skipped: taken.size },
      },
      tx,
    );
    return { created: fresh.length, skipped: taken.size };
  });
}

export async function setTileActive(ctx: Context, id: string, isActive: boolean) {
  const before = await ctx.db.location.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "Tile not found.");
  if (!isActive && (await ctx.db.stockBalance.count({ where: { locationId: id } })) > 0) {
    throw new HttpError(400, `Tile ${before.code} still holds stock. Move it first.`);
  }
  await ctx.db.location.update({ where: { id }, data: { isActive } });
  await audit({
    ...ctx.auditMeta,
    action: isActive ? "tile.activate" : "tile.deactivate",
    entity: "location",
    entityId: id,
    before,
  });
  return { id };
}

// ------------------------------------------------------------------ users

const ROLES = ["ADMIN", "WAREHOUSE_MANAGER", "STORE_KEEPER", "BILLING", "VIEWER"] as const;

export const userSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  role: z.enum(ROLES),
  password: z.string().optional(),
  isActive: z.boolean().default(true),
});

/** ADMIN manages users of their own company. Nobody can create a SUPER_ADMIN here. */
export async function saveUser(ctx: Context, input: { key?: string; id?: string; data: z.input<typeof userSchema> }) {
  const v = userSchema.parse(input.data);
  if (v.password) {
    const problem = validatePassword(v.password);
    if (problem) throw new HttpError(400, problem);
  } else if (!input.id) throw new HttpError(400, "Set an initial password.");
  const passwordHash = v.password ? await hashPassword(v.password) : undefined;
  return once(ctx, input.key, "user.save", async (tx) => {
    if (input.id) {
      const before = await tx.user.findUnique({ where: { id: input.id } });
      if (!before) throw new HttpError(404, "User not found.");
      if (before.role === "SUPER_ADMIN") throw new HttpError(403, "The owner account cannot be edited here.");
      if (before.id === ctx.user.id && (!v.isActive || v.role !== before.role))
        throw new HttpError(400, "You cannot change your own role or deactivate yourself.");
      const u = await tx.user.update({
        where: { id: input.id },
        data: {
          name: v.name,
          email: v.email,
          role: v.role as Role,
          isActive: v.isActive,
          ...(passwordHash
            ? { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null }
            : {}),
        },
      });
      if (passwordHash || !v.isActive) await prisma.session.deleteMany({ where: { userId: u.id } });
      await audit(
        {
          ...ctx.auditMeta,
          action: "user.update",
          entity: "user",
          entityId: u.id,
          before: { ...before, passwordHash: undefined },
          after: { ...v, password: v.password ? "(changed)" : undefined },
        },
        tx,
      );
      return { id: u.id };
    }
    if (await prisma.user.findUnique({ where: { email: v.email } }))
      throw new HttpError(409, `${v.email} already has an account.`);
    const u = await tx.user.create({
      data: {
        companyId: ctx.company.id,
        name: v.name,
        email: v.email,
        role: v.role as Role,
        isActive: v.isActive,
        passwordHash: passwordHash!,
      },
    });
    await audit(
      { ...ctx.auditMeta, action: "user.create", entity: "user", entityId: u.id, after: { ...v, password: "(set)" } },
      tx,
    );
    return { id: u.id };
  });
}
