import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getContext, type Context } from "@/server/auth/context";
import { hashPassword } from "@/server/auth/password";
import { createPurchaseOrder, confirmPutaway, putawayQueue, receiveGoods } from "@/server/ops/inward";
import { confirmPick, createSalesOrder, dispatchOrder, generatePickList, packOrder } from "@/server/ops/outward";
import { approveCount, createCount, decideWriteOff, enterCounts, reportWriteOff } from "@/server/ops/internal";
import { parsePeriod, runReport } from "@/server/reports";
import { toPdf, toXlsx } from "@/server/export";
import { PASSWORD, signInAs } from "./helpers";

// A fresh company with a known dataset, so every report total can be asserted exactly.
const DAY = 86_400_000;
let ctx: Context;
let A: string;
let B: string;
const period = parsePeriod(
  new Date(Date.now() - 5 * DAY).toISOString().slice(0, 10),
  new Date().toISOString().slice(0, 10),
);

beforeAll(async () => {
  const wh = await prisma.warehouse.findFirstOrThrow();
  const co = await prisma.company.create({ data: { name: "Report Test Co", slug: "report-test", code: "RT" } });
  const s = { companyId: co.id, warehouseId: wh.id };
  await prisma.user.create({
    data: {
      companyId: co.id,
      email: "manager@reporttest.test",
      name: "RT Manager",
      role: "WAREHOUSE_MANAGER",
      passwordHash: await hashPassword(PASSWORD),
    },
  });
  await prisma.location.createMany({
    data: [
      { ...s, code: "RT-A-01-1", zone: "RT", row: 1, column: 1, level: 1, capacity: 1000 },
      { ...s, code: "RT-A-02-1", zone: "RT", row: 1, column: 2, level: 1, capacity: 1000 },
      { ...s, code: "RTX-R-01-1", zone: "RTX", row: 18, column: 1, level: 1, type: "RECEIVING" },
      { ...s, code: "RTX-X-01-1", zone: "RTX", row: 24, column: 1, level: 1, type: "DAMAGED" },
    ],
  });
  const tile = (code: string) => prisma.location.findFirstOrThrow({ where: { code } });
  A = (
    await prisma.product.create({
      data: {
        ...s,
        sku: "RT-A",
        name: "Alpha",
        purchasePrice: 10,
        mrp: 20,
        minStock: 50,
        expiryTracked: true,
        defaultLocationId: (await tile("RT-A-01-1")).id,
      },
    })
  ).id;
  B = (
    await prisma.product.create({
      data: {
        ...s,
        sku: "RT-B",
        name: "Beta",
        purchasePrice: 5,
        mrp: 9,
        minStock: 0,
        expiryTracked: true,
        defaultLocationId: (await tile("RT-A-02-1")).id,
      },
    })
  ).id;

  await signInAs("manager@reporttest.test");
  ctx = (await getContext())!;

  // Inward: A 100 good + 4 damaged (expected 110 -> 6 short); B 40 good (expires in 20 days).
  const po = await createPurchaseOrder(ctx, {
    supplierName: "Factory",
    lines: [
      { productId: A, quantity: 110 },
      { productId: B, quantity: 40 },
    ],
  });
  await receiveGoods(ctx, {
    purchaseOrderId: po.id,
    lines: [
      { productId: A, received: 100, damaged: 4, batchNo: "A1", expiryDate: new Date(Date.now() + 400 * DAY) },
      { productId: B, received: 40, batchNo: "B1", expiryDate: new Date(Date.now() + 20 * DAY) },
    ],
  });
  for (const l of await putawayQueue(ctx))
    await confirmPutaway(ctx, { lineId: l.id, tileCode: l.productId === A ? "RT-A-01-1" : "RT-A-02-1" });

  // Outward: 30 of A dispatched.
  const so = await createSalesOrder(ctx, { customerName: "Salon", lines: [{ productId: A, quantity: 30 }] });
  const pick = await generatePickList(ctx, { salesOrderId: so.id });
  const line = await prisma.pickListLine.findFirstOrThrow({ where: { pickListId: pick.id } });
  await confirmPick(ctx, { lineId: line.id, tileCode: "RT-A-01-1", quantity: 30 });
  await packOrder(ctx, { salesOrderId: so.id });
  await dispatchOrder(ctx, { salesOrderId: so.id, vehicleNo: "GJ01AB1234" });

  // Write-off 2 of B (approved) and a count that finds A short by 5.
  const wo = await reportWriteOff(ctx, {
    kind: "DAMAGE",
    productId: B,
    batchId: (await prisma.batch.findFirstOrThrow({ where: { batchNo: "B1" } })).id,
    tileCode: "RT-A-02-1",
    quantity: 2,
    reason: "Crushed",
  });
  await decideWriteOff(ctx, { id: wo.id, approve: true });
  const c = await createCount(ctx, { tileCodes: ["RT-A-01-1"] });
  const cl = await prisma.stockAuditLine.findFirstOrThrow({ where: { stockAuditId: c.id } });
  await enterCounts(ctx, { auditId: c.id, submit: true, lines: [{ lineId: cl.id, counted: 65, reason: "Missing" }] });
  await approveCount(ctx, { auditId: c.id, approve: true });
});

const report = async (key: string) => (await runReport(ctx, key, period))!;
const row = (r: Awaited<ReturnType<typeof report>>, k: string, v: string) => r.rows.find((x) => x[k] === v)!;

describe("report accuracy on a known dataset", () => {
  // Expected on hand: A = 100 - 30 - 5 = 65 (tile) ; B = 40 - 2 = 38 ; damaged tile A = 4
  it("current stock by product", async () => {
    const r = await report("stock-product");
    expect(row(r, "sku", "RT-A").qty).toBe(69);
    expect(row(r, "sku", "RT-B").qty).toBe(38);
    expect(r.totals).toEqual({ qty: 107 });
  });

  it("current stock by batch and by tile", async () => {
    const b = await report("stock-batch");
    expect(row(b, "batch", "A1").qty).toBe(69);
    expect(row(b, "batch", "B1").qty).toBe(38);
    const t = await report("stock-tile");
    expect(t.rows.map((x) => [x.tile, x.sku, x.qty])).toEqual([
      ["RT-A-01-1", "RT-A", 65],
      ["RT-A-02-1", "RT-B", 38],
      ["RTX-X-01-1", "RT-A", 4],
    ]);
  });

  it("valuation at purchase price and MRP", async () => {
    const r = await report("valuation");
    expect(row(r, "sku", "RT-A")).toMatchObject({ qty: 69, value: 690, mrpValue: 1380 });
    expect(row(r, "sku", "RT-B")).toMatchObject({ qty: 38, value: 190, mrpValue: 342 });
    expect(r.totals).toEqual({ qty: 107, value: 880, mrpValue: 1722 });
  });

  it("ageing buckets everything as received today", async () => {
    const r = await report("ageing");
    expect(r.rows.every((x) => x.bucket === "0-30" && x.days === 0)).toBe(true);
    expect(r.totals).toEqual({ qty: 107 });
  });

  it("slow/dead and fast movers", async () => {
    const sd = await report("slow-dead");
    expect(row(sd, "sku", "RT-B")).toMatchObject({ status: "Dead", out: 0, qty: 38 });
    expect(sd.rows.find((x) => x.sku === "RT-A")).toBeUndefined(); // 30 out vs 69 on hand: not slow
    const fm = await report("fast-movers");
    expect(fm.rows).toEqual([{ sku: "RT-A", name: "Alpha", out: 30 }]);
  });

  it("inward vs outward summary", async () => {
    const r = await report("inward-outward");
    expect(r.totals).toEqual({ inward: 144, outward: 30, net: 114 }); // 100 + 4 damaged + 40 in
  });

  it("damage and shortage", async () => {
    const r = await report("damage-shortage");
    expect(r.totals).toEqual({ damaged: 6, short: 6 }); // 4 on arrival + 2 written off; 6 short on A
  });

  it("audit variance", async () => {
    const r = await report("audit-variance");
    expect(r.rows).toEqual([
      expect.objectContaining({ sku: "RT-A", system: 70, counted: 65, variance: -5, reason: "Missing" }),
    ]);
  });

  it("expiry", async () => {
    const r = await report("expiry");
    expect(r.rows).toEqual([expect.objectContaining({ sku: "RT-B", batch: "B1", status: "≤30 days", qty: 38 })]);
  });

  it("movement ledger nets to the stock on hand", async () => {
    const r = await report("ledger");
    expect(r.totals).toEqual({ change: 107 });
  });

  it("user activity counts this user's actions", async () => {
    const r = await report("user-activity");
    expect(r.rows.find((x) => x.action === "dispatch.confirm")).toMatchObject({ count: 1 });
  });

  it("exports to Excel and PDF", async () => {
    const r = await report("valuation");
    const xlsx = await toXlsx([r], { company: "RT" });
    expect(xlsx.subarray(0, 2).toString()).toBe("PK");
    const pdf = await toPdf(r, { company: "RT" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
