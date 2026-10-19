import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getContext, type Context } from "@/server/auth/context";
import { importProducts, parseCsv } from "@/server/ops/masters";
import { importProductsAction } from "@/app/(app)/products/actions";
import { signInAs, USERS } from "./helpers";

let ctx: Context;
beforeAll(async () => {
  await signInAs(USERS.rfAdmin);
  ctx = (await getContext())!;
});

const csv = (s: string) => ({ name: "products.csv", bytes: Buffer.from(s, "utf8") });
async function xlsx(rows: (string | number | boolean | null)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Products");
  rows.forEach((r) => ws.addRow(r));
  return { name: "products.xlsx", bytes: Buffer.from(await wb.xlsx.writeBuffer()) };
}

describe("CSV reader", () => {
  it("handles quotes, commas, escaped quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿sku,name\r\nRF-X,"Shampoo, 1 L"\r\nRF-Y,"He said ""hi"""\n')).toEqual([
      ["sku", "name"],
      ["RF-X", "Shampoo, 1 L"],
      ["RF-Y", 'He said "hi"'],
    ]);
  });
});

describe("product import: bad files", () => {
  it("rejects a file with missing required columns", async () => {
    await expect(importProducts(ctx, csv("name,mrp\nShampoo,100\n"), false)).rejects.toThrow(
      /Missing column\(s\): sku/,
    );
    await expect(
      importProducts(
        ctx,
        await xlsx([
          ["sku", "price"],
          ["RF-A1", 1],
        ]),
        false,
      ),
    ).rejects.toThrow(/Missing column\(s\): name/);
  });

  it("rejects empty files and wrong file types", async () => {
    await expect(importProducts(ctx, csv("sku,name\n"), false)).rejects.toThrow(/no data rows/);
    await expect(importProducts(ctx, { name: "products.pdf", bytes: Buffer.from("%PDF-1.4") }, false)).rejects.toThrow(
      /\.csv or \.xlsx/,
    );
    // An .xlsx name with CSV content (renamed file) is not read as Excel.
    await expect(
      importProducts(ctx, { name: "renamed.xlsx", bytes: Buffer.from("sku,name\nA,B") }, false),
    ).rejects.toThrow(/\.csv or \.xlsx/);
    await expect(
      importProducts(ctx, { name: "big.csv", bytes: Buffer.alloc(3 * 1024 * 1024, 65) }, false),
    ).rejects.toThrow(/2 MB/);
  });

  it("reports duplicates inside the file, row by row", async () => {
    const r = await importProducts(
      ctx,
      csv("sku,name,barcode\nRF-DUP1,One,111111\nRF-DUP1,Two,222222\nRF-DUP2,Three,111111\n"),
      false,
    );
    expect(r.summary).toMatchObject({ total: 3, valid: 1, invalid: 2 });
    expect(r.rows[1]).toMatchObject({ row: 3, errors: ["sku: duplicate of row 2"] });
    expect(r.rows[2]).toMatchObject({ row: 4, errors: ["barcode: duplicate of row 2"] });
  });

  it("reports wrong types and rule violations with the field name", async () => {
    const file = await xlsx([
      ["sku", "name", "pack_size", "min_stock", "max_stock", "mrp", "default_tile"],
      ["rf bad sku!", "Ok name", 1, 0, null, 10, null],
      ["RF-T1", "Ok name", "twelve", 0, null, 10, null],
      ["RF-T2", "Ok name", 1, 50, 10, 10, null],
      ["RF-T3", "Ok name", 1, 0, null, -5, null],
      ["RF-T4", "Ok name", 1.5, 0, null, 10, null],
      ["RF-T5", "Ok name", 1, 0, null, 10, "BT-A-01-1"],
      ["RF-T6", "", 1, 0, null, 10, null],
    ]);
    const r = await importProducts(ctx, file, false);
    const errs = Object.fromEntries(r.rows.map((x) => [x.row, x.errors.join(" | ")]));
    expect(errs[2]).toMatch(/^sku: SKU/);
    expect(errs[3]).toMatch(/packSize/);
    expect(errs[4]).toMatch(/maxStock: Max stock must be at least min stock/);
    expect(errs[5]).toMatch(/mrp: Cannot be negative/);
    expect(errs[6]).toMatch(/packSize: Whole number/);
    expect(errs[7]).toMatch(/default_tile: BT-A-01-1 is not one of your storage tiles/);
    expect(errs[8]).toMatch(/name/);
    expect(r.summary.invalid).toBe(7);
  });

  it("a barcode already used by another product is an error", async () => {
    const taken = await prisma.product.findFirstOrThrow({
      where: { companyId: ctx.company.id, barcode: { not: null } },
    });
    const r = await importProducts(ctx, csv(`sku,name,barcode\nRF-NEWBC,New,${taken.barcode}\n`), false);
    expect(r.rows[0].errors).toEqual([`barcode: already used by ${taken.sku}`]);
  });

  it("will not commit while any row has errors, and writes nothing", async () => {
    const before = await prisma.product.count();
    await expect(importProducts(ctx, csv("sku,name\nRF-OK1,Fine\nbad sku,Broken\n"), true)).rejects.toThrow(
      /Fix the 1 row/,
    );
    expect(await prisma.product.count()).toBe(before);
  });
});

describe("product import: good files", () => {
  it("previews creates and updates, then commits them", async () => {
    const existing = await prisma.product.findFirstOrThrow({
      where: { companyId: ctx.company.id },
      orderBy: { sku: "asc" },
    });
    const file = await xlsx([
      ["SKU", "Name", "Pack Size", "Expiry Tracked", "MRP", "Default Tile", "Colour"],
      ["RF-IMP-1", "Imported mask", 6, "yes", 799.5, "RF-A-02-1", "blue"],
      [existing.sku, "Renamed by import", 4, "no", 100, null, "red"],
    ]);
    const preview = await importProducts(ctx, file, false);
    expect(preview.summary).toMatchObject({ valid: 2, create: 1, update: 1, ignoredColumns: ["colour"] });
    expect(await prisma.product.count({ where: { sku: "RF-IMP-1" } })).toBe(0);

    const done = await importProducts(ctx, file, true);
    expect(done.committed).toBe(true);
    const p = await prisma.product.findFirstOrThrow({
      where: { companyId: ctx.company.id, sku: "RF-IMP-1" },
      include: { defaultLocation: true },
    });
    expect([p.packSize, p.expiryTracked, Number(p.mrp), p.defaultLocation?.code]).toEqual([
      6,
      true,
      799.5,
      "RF-A-02-1",
    ]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: existing.id } })).name).toBe("Renamed by import");
  });

  it("imports into the signed-in company only", async () => {
    await importProducts(ctx, csv("sku,name\nRF-ONLY-1,Only Rich Fill\n"), true);
    const p = await prisma.product.findFirstOrThrow({ where: { sku: "RF-ONLY-1" } });
    expect(p.companyId).toBe(ctx.company.id);
  });

  it("is blocked for roles without products.manage", async () => {
    await signInAs(USERS.rfViewer);
    const form = new FormData();
    form.set("file", new File(["sku,name\nRF-V1,Nope\n"], "p.csv", { type: "text/csv" }));
    form.set("commit", "1");
    expect(await importProductsAction(form)).toMatchObject({ ok: false });
    expect(await prisma.product.count({ where: { sku: "RF-V1" } })).toBe(0);
    await signInAs(USERS.rfAdmin);
  });
});
