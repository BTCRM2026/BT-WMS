import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getContext, type Context } from "@/server/auth/context";
import { generateTiles, saveProduct, setCapacity } from "@/server/ops/masters";
import { confirmPutaway, putawayQueue, receiveGoods, suggestSplits } from "@/server/ops/inward";
import { writeOffReceiptDamage } from "@/server/ops/internal";
import { candidates } from "@/server/alerts";
import { dashboardData } from "@/server/insights";
import { tenantDb } from "@/server/db/tenant";
import { companies, signInAs, USERS } from "./helpers";

const DAY = 86_400_000;
let ctx: Context;
let productId: string;
let bigId: string;

async function as(email: string) {
  await signInAs(email);
  return (await getContext())!;
}
async function on(code: string, pid = productId) {
  const tile = await prisma.location.findFirstOrThrow({ where: { code } });
  const agg = await prisma.stockBalance.aggregate({
    where: { productId: pid, locationId: tile.id },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}
const lot = (received: number, extra: Record<string, unknown> = {}) => ({
  productId,
  received,
  batchNo: "RPA-1",
  expiryDate: new Date(Date.now() + 400 * DAY),
  ...extra,
});
const lineOf = (receiptId: string) =>
  prisma.inwardReceiptLine.findFirstOrThrow({ where: { inwardReceiptId: receiptId } });

beforeAll(async () => {
  ctx = await as(USERS.btManager);
  // Zone BTP: row A, columns 1-3, level 1 holds 3 boxes, level 2 holds 5 boxes.
  const g = await generateTiles(ctx, {
    zone: "BTP",
    rows: "A",
    columnFrom: 1,
    columnTo: 3,
    levelFrom: 1,
    levelTo: 2,
    levelCapacity: { "1": 3, "2": 5 },
  });
  expect(g.created).toBe(6);
  productId = (
    await saveProduct(ctx, {
      data: { sku: "BT-RPA-1", name: "Receive putaway serum", packSize: 10, defaultTileCode: "BTP-A-01-1" },
    })
  ).id;
  bigId = (
    await saveProduct(ctx, {
      data: { sku: "BT-RPA-BIG", name: "Big carton", packSize: 1, maxBoxesPerTile: 1, defaultTileCode: "BTP-A-03-2" },
    })
  ).id;
});

describe("tile capacity in boxes", () => {
  it("the generator sets capacity per level", async () => {
    const caps = await prisma.location.findMany({ where: { zone: "BTP" }, select: { code: true, capacity: true } });
    expect(Object.fromEntries(caps.map((c) => [c.code, c.capacity]))).toEqual({
      "BTP-A-01-1": 3,
      "BTP-A-01-2": 5,
      "BTP-A-02-1": 3,
      "BTP-A-02-2": 5,
      "BTP-A-03-1": 3,
      "BTP-A-03-2": 5,
    });
  });

  it("bulk update is tenant scoped and audited", async () => {
    const r = await setCapacity(ctx, {
      zone: "BTP",
      rows: "A",
      columnFrom: 3,
      columnTo: 3,
      levelFrom: 1,
      levelTo: 2,
      capacity: 4,
    });
    expect(r.updated).toBe(2);
    expect((await prisma.location.findFirstOrThrow({ where: { code: "BTP-A-03-1" } })).capacity).toBe(4);
    const log = await prisma.auditLog.findFirst({ where: { action: "tile.capacity" }, orderBy: { createdAt: "desc" } });
    expect(log?.before).toEqual([
      { code: "BTP-A-03-1", capacity: 3 },
      { code: "BTP-A-03-2", capacity: 5 },
    ]);
    // Another company's tiles: neither by zone nor by id.
    await expect(setCapacity(ctx, { zone: "RF", capacity: 1 })).rejects.toThrow(/Zone must start with BT/);
    const rfTile = await prisma.location.findFirstOrThrow({ where: { code: "RF-A-01-1" } });
    await expect(setCapacity(ctx, { ids: [rfTile.id], capacity: 1 })).rejects.toThrow(/No tiles match/);
    expect((await prisma.location.findUniqueOrThrow({ where: { id: rfTile.id } })).capacity).toBe(rfTile.capacity);
  });
});

describe("receive with put away now", () => {
  it("puts everything on the default tile when it fits", async () => {
    const r = await receiveGoods(ctx, {
      putAwayNow: true,
      lines: [lot(20, { putAway: [{ tileCode: "BTP-A-01-1", quantity: 20 }] })],
    });
    expect(await on("BTX-R-01-1")).toBe(0);
    expect(await on("BTP-A-01-1")).toBe(20);
    const line = await lineOf(r.id);
    expect([line.putawayQuantity, !!line.putawayAt]).toEqual([20, true]);
  });

  it("suggests a split by boxes and posts it", async () => {
    // A-01-1 has 2 of 3 boxes used -> 1 box (10 units); A-01-2 takes 5 boxes; A-02-1 the last 3 boxes.
    const [plan] = await suggestSplits(ctx, [{ productId, quantity: 90 }]);
    expect(plan).toEqual([
      { tileCode: "BTP-A-01-1", quantity: 10 },
      { tileCode: "BTP-A-01-2", quantity: 50 },
      { tileCode: "BTP-A-02-1", quantity: 30 },
    ]);
    const r = await receiveGoods(ctx, { putAwayNow: true, lines: [lot(90, { putAway: plan })] });
    expect([await on("BTP-A-01-1"), await on("BTP-A-01-2"), await on("BTP-A-02-1")]).toEqual([30, 50, 30]);
    expect((await lineOf(r.id)).putawayAt).not.toBeNull();
  });

  it("a part placed now, the rest waits in the queue and can be split later", async () => {
    const r = await receiveGoods(ctx, {
      putAwayNow: true,
      lines: [lot(50, { putAway: [{ tileCode: "BTP-A-02-2", quantity: 20 }] })],
    });
    expect(await on("BTX-R-01-1")).toBe(30);
    const queued = (await putawayQueue(ctx)).find((l) => l.inwardReceiptId === r.id)!;
    expect(queued.quantity - queued.putawayQuantity).toBe(30);
    await confirmPutaway(ctx, {
      lineId: queued.id,
      parts: [
        { tileCode: "BTP-A-02-2", quantity: 10 },
        { tileCode: "BTP-A-03-1", quantity: 10 },
      ],
    });
    expect((await lineOf(r.id)).putawayAt).toBeNull();
    await confirmPutaway(ctx, { lineId: queued.id, tileCode: "BTP-A-03-1" });
    expect([await on("BTX-R-01-1"), await on("BTP-A-02-2"), await on("BTP-A-03-1")]).toEqual([0, 30, 20]);
    expect((await lineOf(r.id)).putawayAt).not.toBeNull();
  });

  it("refuses to overfill a tile and posts nothing", async () => {
    const before = await prisma.inwardReceipt.count();
    await expect(
      receiveGoods(ctx, { putAwayNow: true, lines: [lot(5, { putAway: [{ tileCode: "BTP-A-01-1", quantity: 5 }] })] }),
    ).rejects.toThrow(/BTP-A-01-1 has room for 0 more units of BT-RPA-1 only \(3 boxes max, 3 on it now\)/);
    expect(await prisma.inwardReceipt.count()).toBe(before);
    expect(await on("BTX-R-01-1")).toBe(0);
  });

  it("refuses another company's tile, non-storage tiles and more than the good units", async () => {
    await expect(
      receiveGoods(ctx, { putAwayNow: true, lines: [lot(5, { putAway: [{ tileCode: "RF-A-01-1", quantity: 5 }] })] }),
    ).rejects.toThrow(/not in a Bond Therapy zone/);
    await expect(
      receiveGoods(ctx, { putAwayNow: true, lines: [lot(5, { putAway: [{ tileCode: "BTX-Q-01-1", quantity: 5 }] })] }),
    ).rejects.toThrow(/quarantine tile/);
    await expect(
      receiveGoods(ctx, { putAwayNow: true, lines: [lot(5, { putAway: [{ tileCode: "BTP-A-03-2", quantity: 6 }] })] }),
    ).rejects.toThrow(/Tiles add up to 6, more than the 5 good units/);
    expect(await on("BTX-R-01-1")).toBe(0);
  });

  it("respects the product's max boxes per tile", async () => {
    const [plan] = await suggestSplits(ctx, [{ productId: bigId, quantity: 3 }]);
    expect(plan.map((p) => p.quantity)).toEqual([1, 1, 1]);
    expect(plan[0].tileCode).toBe("BTP-A-03-2");
    await expect(
      receiveGoods(ctx, {
        putAwayNow: true,
        lines: [{ productId: bigId, received: 2, putAway: [{ tileCode: "BTP-A-03-2", quantity: 2 }] }],
      }),
    ).rejects.toThrow(/room for 1 more units of BT-RPA-BIG only \(1 boxes max/);
  });

  it("put away now OFF behaves as before: everything waits on the receiving tile", async () => {
    const r = await receiveGoods(ctx, {
      putAwayNow: false,
      lines: [lot(10, { putAway: [{ tileCode: "BTP-A-03-2", quantity: 10 }] })],
    });
    expect(await on("BTX-R-01-1")).toBe(10);
    expect(await on("BTP-A-03-2")).toBe(0);
    const line = await lineOf(r.id);
    expect([line.putawayQuantity, line.putawayAt]).toEqual([0, null]);
    await confirmPutaway(ctx, { lineId: line.id, tileCode: "BTP-A-03-2" });
    expect(await on("BTX-R-01-1")).toBe(0);
  });

  it("a double submit with the same key posts once", async () => {
    const input = {
      key: "rpa-double-1",
      putAwayNow: true,
      lines: [lot(10, { putAway: [{ tileCode: "BTP-A-03-2", quantity: 10 }] })],
    };
    const [a, b] = await Promise.all([receiveGoods(ctx, input), receiveGoods(ctx, input)]);
    expect(a.id).toBe(b.id);
    expect(await on("BTP-A-03-2")).toBe(20);
    expect(await prisma.inwardReceiptLine.count({ where: { inwardReceiptId: a.id } })).toBe(1);
  });
});

describe("damaged on receipt", () => {
  it("one tap writes off the damaged cartons, linked to the receipt line, once", async () => {
    const { bt } = await companies();
    const r = await receiveGoods(ctx, {
      putAwayNow: true,
      lines: [lot(0, { damaged: 3 })],
    });
    const line = await lineOf(r.id);
    expect(await on("BTX-X-01-1")).toBe(3);

    await prisma.companySetting.upsert({
      where: { companyId: bt.id },
      update: { writeOffApproval: true },
      create: { companyId: bt.id, writeOffApproval: true },
    });
    const wo = await writeOffReceiptDamage(ctx, { lineId: line.id });
    const d = await prisma.damage.findUniqueOrThrow({ where: { id: wo.id } });
    expect([d.status, d.kind, d.quantity, d.receiptLineId, d.reason]).toEqual([
      "DRAFT",
      "DAMAGE",
      3,
      line.id,
      `Damaged on receipt ${r.receiptNumber}`,
    ]);
    expect(await on("BTX-X-01-1")).toBe(3); // waits for approval
    await expect(writeOffReceiptDamage(ctx, { lineId: line.id })).rejects.toThrow(/Already written off/);

    // Without approval it posts straight away.
    await prisma.damage.update({ where: { id: wo.id }, data: { status: "CANCELLED" } });
    await prisma.companySetting.update({ where: { companyId: bt.id }, data: { writeOffApproval: false } });
    try {
      const again = await writeOffReceiptDamage(ctx, { lineId: line.id });
      expect((await prisma.damage.findUniqueOrThrow({ where: { id: again.id } })).status).toBe("POSTED");
      expect(await on("BTX-X-01-1")).toBe(0);
      await expect(writeOffReceiptDamage(ctx, { lineId: line.id })).rejects.toThrow(/Already written off/);
    } finally {
      await prisma.companySetting.update({ where: { companyId: bt.id }, data: { writeOffApproval: true } });
    }
  });

  it("another company cannot write off this company's receipt line", async () => {
    const line = await prisma.inwardReceiptLine.findFirstOrThrow({ where: { productId, damagedQuantity: { gt: 0 } } });
    const rf = await as(USERS.rfAdmin);
    await expect(writeOffReceiptDamage(rf, { lineId: line.id })).rejects.toThrow(/not found/i);
    ctx = await as(USERS.btManager);
  });
});

describe("early warning for goods on the receiving tile", () => {
  it("dashboard and digest use the company's hours (default 4)", async () => {
    const { bt } = await companies();
    const r = await receiveGoods(ctx, { lines: [lot(10)] });
    const db = tenantDb(bt.id);
    const flagged = async () => (await candidates(db)).some((c) => c.kind === "pending-putaway" && c.key === line.id);
    const line = await lineOf(r.id);
    expect((await dashboardData(db)).staleReceiving.lines).toBe(0);

    await prisma.inwardReceipt.update({
      where: { id: r.id },
      data: { receivedAt: new Date(Date.now() - 5 * 3600_000) },
    });
    const d = await dashboardData(db);
    expect(d.staleReceiving).toMatchObject({ hours: 4, lines: 1, units: 10 });
    expect(await flagged()).toBe(true);

    await prisma.companySetting.update({ where: { companyId: bt.id }, data: { receivingAlertHours: 6 } });
    try {
      expect((await dashboardData(db)).staleReceiving.lines).toBe(0);
      expect(await flagged()).toBe(false);
    } finally {
      await prisma.companySetting.update({ where: { companyId: bt.id }, data: { receivingAlertHours: 4 } });
    }
    await confirmPutaway(ctx, { lineId: line.id, tileCode: "BTP-A-03-2" });
  });
});
