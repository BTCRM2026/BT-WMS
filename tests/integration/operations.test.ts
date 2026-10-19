import { beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db/client";
import { getContext, type Context } from "@/server/auth/context";
import { saveProduct } from "@/server/ops/masters";
import { createPurchaseOrder, confirmPutaway, putawayQueue, receiveGoods, suggestFor } from "@/server/ops/inward";
import {
  cancelDispatch,
  confirmPick,
  createSalesOrder,
  dispatchOrder,
  generatePickList,
  packOrder,
} from "@/server/ops/outward";
import {
  approveCount,
  createCount,
  decideWriteOff,
  enterCounts,
  inspectReturn,
  receiveReturn,
  reportWriteOff,
  transferStock,
} from "@/server/ops/internal";
import { decideWriteOffAction } from "@/app/(app)/damages/actions";
import { approveCountAction } from "@/app/(app)/stock-audits/actions";
import { createSoAction } from "@/app/(app)/sales-orders/actions";
import { signInAs, USERS } from "./helpers";

// Lets one test make the audit write fail half-way through a transfer.
const failOn = vi.hoisted(() => ({ type: null as string | null }));
vi.mock("@/server/audit", async (orig) => {
  const real = await orig<typeof import("@/server/audit")>();
  return {
    ...real,
    audit: async (e: Parameters<typeof real.audit>[0], db?: Parameters<typeof real.audit>[1]) => {
      if (failOn.type && (e.after as { type?: string } | undefined)?.type === failOn.type)
        throw new Error("injected failure");
      return real.audit(e, db);
    },
  };
});

const DAY = 86_400_000;
let ctx: Context;
let productId: string;

async function as(email: string) {
  await signInAs(email);
  return (await getContext())!;
}
async function tileId(code: string) {
  return (await prisma.location.findFirstOrThrow({ where: { code } })).id;
}
/** Units of the test product on a tile (optionally one batch), straight from the ledger view. */
async function on(code: string, batchNo?: string) {
  const batch = batchNo ? await prisma.batch.findFirst({ where: { productId, batchNo } }) : undefined;
  const agg = await prisma.stockBalance.aggregate({
    where: { productId, locationId: await tileId(code), ...(batch ? { batchId: batch.id } : {}) },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}
const total = async () =>
  (await prisma.stockBalance.aggregate({ where: { productId }, _sum: { quantity: true } }))._sum.quantity ?? 0;

beforeAll(async () => {
  ctx = await as(USERS.btManager);
  productId = (
    await saveProduct(ctx, {
      data: {
        sku: "BT-CYCLE-1",
        name: "Cycle test serum",
        expiryTracked: true,
        minStock: 5,
        defaultTileCode: "BT-D-10-1",
        mrp: 500,
      },
    })
  ).id;
});

describe("full cycle: inward -> putaway -> order -> pick -> dispatch", () => {
  let poId: string;
  let soId: string;

  it("receives 90 good + 6 damaged of 100 ordered (4 short); nothing pickable yet", async () => {
    poId = (
      await createPurchaseOrder(ctx, { supplierName: "Bond Therapy Factory", lines: [{ productId, quantity: 100 }] })
    ).id;
    await receiveGoods(ctx, {
      purchaseOrderId: poId,
      lines: [
        {
          productId,
          received: 90,
          damaged: 6,
          batchNo: "CYC-1",
          mfgDate: new Date(Date.now() - 30 * DAY),
          expiryDate: new Date(Date.now() + 300 * DAY),
        },
      ],
    });
    expect(await on("BTX-R-01-1")).toBe(90);
    expect(await on("BTX-X-01-1")).toBe(6);
    expect(await on("BT-D-10-1")).toBe(0);
    const line = await prisma.inwardReceiptLine.findFirstOrThrow({ where: { productId } });
    expect([line.quantity, line.damagedQuantity, line.shortQuantity]).toEqual([90, 6, 4]);
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } })).status).toBe("PARTIALLY_RECEIVED");
    await expect(
      generatePickList(ctx, {
        salesOrderId: (await createSalesOrder(ctx, { customerName: "Early bird", lines: [{ productId, quantity: 1 }] }))
          .id,
      }),
    ).rejects.toThrow(/No pickable stock/);
  });

  it("suggests the default tile and refuses another company's zone", async () => {
    const line = (await putawayQueue(ctx)).find((l) => l.productId === productId)!;
    expect((await suggestFor(ctx, line.id))?.code).toBe("BT-D-10-1");
    await expect(confirmPutaway(ctx, { lineId: line.id, tileCode: "RF-A-01-1" })).rejects.toThrow(
      /not in a Bond Therapy zone/,
    );
    await expect(confirmPutaway(ctx, { lineId: line.id, tileCode: "BTX-Q-01-1" })).rejects.toThrow(/quarantine tile/);
    await confirmPutaway(ctx, { lineId: line.id, tileCode: "bt-d-10-1" });
    expect(await on("BTX-R-01-1")).toBe(0);
    expect(await on("BT-D-10-1")).toBe(90);
    await expect(confirmPutaway(ctx, { lineId: line.id, tileCode: "BT-D-10-1" })).rejects.toThrow(/already put away/);
  });

  it("allocates a pick list, confirms it at the right tile, dispatches", async () => {
    // Clear the earlier unpickable order out of the way.
    await prisma.salesOrder.updateMany({ where: { customerName: "Early bird" }, data: { status: "CANCELLED" } });
    soId = (await createSalesOrder(ctx, { customerName: "Salon One", lines: [{ productId, quantity: 50 }] })).id;
    const pick = await generatePickList(ctx, { salesOrderId: soId });
    expect(pick.shortages).toEqual([]);
    const line = await prisma.pickListLine.findFirstOrThrow({
      where: { pickListId: pick.id },
      include: { location: true, batch: true },
    });
    expect([line.location.code, line.batch?.batchNo, line.quantity]).toEqual(["BT-D-10-1", "CYC-1", 50]);

    await expect(confirmPick(ctx, { lineId: line.id, tileCode: "BT-A-01-1", quantity: 50 })).rejects.toThrow(
      /Wrong tile/,
    );
    await expect(confirmPick(ctx, { lineId: line.id, tileCode: "BT-D-10-1", quantity: 45 })).rejects.toThrow(
      /give a reason/,
    );
    await confirmPick(ctx, { lineId: line.id, tileCode: "BT-D-10-1", quantity: 50 });
    expect(await on("BT-D-10-1")).toBe(90); // picking does not move stock

    await packOrder(ctx, { salesOrderId: soId });
    const d = await dispatchOrder(ctx, {
      salesOrderId: soId,
      vehicleNo: "MH12AB1234",
      lrNumber: "LR-1",
      transporter: "Fast Freight",
    });
    expect(await on("BT-D-10-1")).toBe(40);
    expect((await prisma.salesOrder.findUniqueOrThrow({ where: { id: soId } })).status).toBe("DISPATCHED");
    expect(
      await prisma.stockMovement.count({
        where: { referenceType: "DISPATCH", referenceId: d.id, type: "OUTWARD", quantity: 50 },
      }),
    ).toBe(1);
  });

  it("cancelling a dispatch reverses the stock; the original rows stay", async () => {
    const d = await prisma.dispatch.findFirstOrThrow({ where: { salesOrderId: soId, status: "POSTED" } });
    await cancelDispatch(ctx, { dispatchId: d.id, reason: "Customer postponed" });
    expect(await on("BT-D-10-1")).toBe(90);
    expect(await prisma.stockMovement.count({ where: { referenceId: d.id } })).toBe(1);
    expect((await prisma.salesOrder.findUniqueOrThrow({ where: { id: soId } })).status).toBe("PACKED");
    // Partial dispatch: 20 now, 30 later.
    const pl = await prisma.pickListLine.findFirstOrThrow({ where: { pickList: { salesOrderId: soId } } });
    await dispatchOrder(ctx, {
      salesOrderId: soId,
      vehicleNo: "MH12AB1234",
      lines: [{ pickListLineId: pl.id, quantity: 20 }],
    });
    expect(await on("BT-D-10-1")).toBe(70);
    expect((await prisma.salesOrder.findUniqueOrThrow({ where: { id: soId } })).status).toBe("PACKED");
    await dispatchOrder(ctx, { salesOrderId: soId, vehicleNo: "MH12AB1234" });
    expect(await on("BT-D-10-1")).toBe(40);
    expect((await prisma.salesOrder.findUniqueOrThrow({ where: { id: soId } })).status).toBe("DISPATCHED");
    expect(await total()).toBe(46); // 40 on the shelf + 6 damaged
  });
});

describe("FEFO never picks expired stock", () => {
  it("skips the expired batch and reports the shortage", async () => {
    await receiveGoods(ctx, {
      lines: [
        {
          productId,
          received: 30,
          batchNo: "OLD-1",
          mfgDate: new Date(Date.now() - 400 * DAY),
          expiryDate: new Date(Date.now() - DAY),
        },
      ],
    });
    const line = (await putawayQueue(ctx)).find((l) => l.batch?.batchNo === "OLD-1")!;
    await confirmPutaway(ctx, { lineId: line.id, tileCode: "BT-D-09-1" });
    const so = await createSalesOrder(ctx, { customerName: "Salon Two", lines: [{ productId, quantity: 60 }] });
    const pick = await generatePickList(ctx, { salesOrderId: so.id });
    const lines = await prisma.pickListLine.findMany({ where: { pickListId: pick.id }, include: { batch: true } });
    expect(lines.map((l) => [l.batch?.batchNo, l.quantity])).toEqual([["CYC-1", 40]]);
    expect(pick.shortages).toEqual([{ sku: "BT-CYCLE-1", short: 20 }]);
    await prisma.pickList.update({ where: { id: pick.id }, data: { status: "CANCELLED" } });
    await prisma.salesOrder.update({ where: { id: so.id }, data: { status: "CANCELLED" } });
  });
});

describe("transfers are atomic", () => {
  it("moves both sides together", async () => {
    await transferStock(ctx, {
      productId,
      batchId: (await prisma.batch.findFirstOrThrow({ where: { batchNo: "CYC-1" } })).id,
      fromCode: "BT-D-10-1",
      toCode: "BT-C-10-1",
      quantity: 15,
      reason: "Re-slot",
    });
    expect([await on("BT-D-10-1"), await on("BT-C-10-1")]).toEqual([25, 15]);
  });

  it("a failure half-way leaves nothing changed", async () => {
    const before = [await on("BT-D-10-1"), await on("BT-C-10-1"), await prisma.stockMovement.count()];
    failOn.type = "TRANSFER_IN"; // TRANSFER_OUT is already inserted when this fires
    try {
      await expect(
        transferStock(ctx, {
          productId,
          batchId: (await prisma.batch.findFirstOrThrow({ where: { batchNo: "CYC-1" } })).id,
          fromCode: "BT-D-10-1",
          toCode: "BT-C-10-1",
          quantity: 5,
          reason: "Will fail",
        }),
      ).rejects.toThrow(/injected failure/);
    } finally {
      failOn.type = null;
    }
    expect([await on("BT-D-10-1"), await on("BT-C-10-1"), await prisma.stockMovement.count()]).toEqual(before);
  });

  it("cannot transfer more than is on the tile", async () => {
    await expect(
      transferStock(ctx, {
        productId,
        batchId: null,
        fromCode: "BT-D-10-1",
        toCode: "BT-C-10-1",
        quantity: 1,
        reason: "No batch",
      }),
    ).rejects.toThrow(/Only 0/);
  });
});

describe("concurrency: the last 10 units", () => {
  let lastId: string;
  beforeAll(async () => {
    lastId = (await saveProduct(ctx, { data: { sku: "BT-LAST-10", name: "Last ten", defaultTileCode: "BT-D-08-1" } }))
      .id;
    await receiveGoods(ctx, { lines: [{ productId: lastId, received: 10 }] });
    const line = (await putawayQueue(ctx)).find((l) => l.productId === lastId)!;
    await confirmPutaway(ctx, { lineId: line.id, tileCode: "BT-D-08-1" });
  });

  it("two pick lists racing for the same 10 units: only one gets them", async () => {
    const [a, b] = await Promise.all(
      [1, 2].map((n) =>
        createSalesOrder(ctx, { customerName: `Racer ${n}`, lines: [{ productId: lastId, quantity: 10 }] }),
      ),
    );
    const results = await Promise.allSettled([
      generatePickList(ctx, { salesOrderId: a.id }),
      generatePickList(ctx, { salesOrderId: b.id }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const allocated = await prisma.pickListLine.aggregate({ where: { productId: lastId }, _sum: { quantity: true } });
    expect(allocated._sum.quantity).toBe(10);
  });

  it("two simultaneous dispatches of the last 10 units: only one ships", async () => {
    const pick = await prisma.pickList.findFirstOrThrow({ where: { lines: { some: { productId: lastId } } } });
    const line = await prisma.pickListLine.findFirstOrThrow({ where: { pickListId: pick.id } });
    await confirmPick(ctx, { lineId: line.id, tileCode: "BT-D-08-1", quantity: 10 });
    await packOrder(ctx, { salesOrderId: pick.salesOrderId });
    const results = await Promise.allSettled([
      dispatchOrder(ctx, { key: "race-a", salesOrderId: pick.salesOrderId, vehicleNo: "KA01AA0001" }),
      dispatchOrder(ctx, { key: "race-b", salesOrderId: pick.salesOrderId, vehicleNo: "KA01AA0002" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const left = await prisma.stockBalance.aggregate({ where: { productId: lastId }, _sum: { quantity: true } });
    expect(left._sum.quantity ?? 0).toBe(0);
    expect(await prisma.dispatch.count({ where: { salesOrderId: pick.salesOrderId, status: "POSTED" } })).toBe(1);
  });
});

describe("duplicate submits", () => {
  it("the same key twice (double click / retry) creates one order", async () => {
    const input = { key: "dup-so-1", customerName: "Double clicker", lines: [{ productId, quantity: 1 }] };
    const [a, b] = await Promise.all([createSalesOrder(ctx, input), createSalesOrder(ctx, input)]);
    expect(a.id).toBe(b.id);
    expect(await prisma.salesOrder.count({ where: { customerName: "Double clicker" } })).toBe(1);
    const c = await createSalesOrder(ctx, input);
    expect(c.id).toBe(a.id);
  });

  it("a duplicated receipt posts stock once", async () => {
    const before = await total();
    const input = {
      key: "dup-grn-1",
      lines: [{ productId, received: 7, batchNo: "DUP-1", expiryDate: new Date(Date.now() + 100 * DAY) }],
    };
    await Promise.all([receiveGoods(ctx, input), receiveGoods(ctx, input), receiveGoods(ctx, input)]);
    expect(await total()).toBe(before + 7);
  });
});

describe("returns, write-offs and cycle counts", () => {
  it("customer return -> RETURN tile -> restock", async () => {
    const r = await receiveReturn(ctx, {
      customerName: "Salon One",
      productId,
      batchNo: "CYC-1",
      quantity: 5,
      reason: "Wrong shade",
    });
    expect(await on("BTX-RT-01-1")).toBe(5);
    await inspectReturn(ctx, { returnId: r.id, disposition: "RESTOCK", restockTileCode: "BT-C-10-1" });
    expect(await on("BTX-RT-01-1")).toBe(0);
    expect(await on("BT-C-10-1")).toBe(20);
  });

  it("damaged return waits for manager approval, store keeper cannot approve", async () => {
    const r = await receiveReturn(ctx, {
      customerName: "Salon One",
      productId,
      batchNo: "CYC-1",
      quantity: 3,
      reason: "Leaking",
    });
    await inspectReturn(ctx, { returnId: r.id, disposition: "DAMAGE", notes: "Cap broken" });
    const wo = await prisma.damage.findFirstOrThrow({ where: { returnId: r.id } });
    expect(await on("BTX-RT-01-1")).toBe(3);

    await signInAs(USERS.btKeeper);
    expect(await decideWriteOffAction({ id: wo.id, approve: true })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/permission/),
    });
    expect(await on("BTX-RT-01-1")).toBe(3);

    await signInAs(USERS.btManager);
    expect(await decideWriteOffAction({ id: wo.id, approve: true })).toMatchObject({ ok: true });
    expect(await on("BTX-RT-01-1")).toBe(0);
    expect((await prisma.stockReturn.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("CLOSED");
  });

  it("expiry write-off: reported, rejected, nothing moves", async () => {
    const wo = await reportWriteOff(ctx, {
      kind: "EXPIRY",
      productId,
      batchId: (await prisma.batch.findFirstOrThrow({ where: { batchNo: "OLD-1" } })).id,
      tileCode: "BT-D-09-1",
      quantity: 30,
      reason: "Expired",
    });
    await decideWriteOff(ctx, { id: wo.id, approve: false });
    expect(await on("BT-D-09-1")).toBe(30);
  });

  it("cycle count: variance needs a reason and manager approval, then posts an ADJUSTMENT", async () => {
    const c = await createCount(ctx, { tileCodes: ["BT-C-10-1"] });
    const lines = await prisma.stockAuditLine.findMany({ where: { stockAuditId: c.id } });
    const line = lines.find((l) => l.productId === productId)!;
    expect(line.systemQuantity).toBe(20);
    // Other products on the tile count exactly as the system says.
    const others = lines.filter((l) => l !== line).map((l) => ({ lineId: l.id, counted: l.systemQuantity }));
    await expect(
      enterCounts(ctx, { auditId: c.id, submit: true, lines: [{ lineId: line.id, counted: 17 }] }),
    ).rejects.toThrow(/not counted yet/);
    await expect(
      enterCounts(ctx, { auditId: c.id, submit: true, lines: [...others, { lineId: line.id, counted: 17 }] }),
    ).rejects.toThrow(/need a reason/);
    await enterCounts(ctx, {
      auditId: c.id,
      submit: true,
      lines: [...others, { lineId: line.id, counted: 17, reason: "3 broken, found in count" }],
    });

    await signInAs(USERS.btKeeper);
    expect(await approveCountAction({ auditId: c.id, approve: true })).toMatchObject({ ok: false });
    expect(await on("BT-C-10-1")).toBe(20);

    await signInAs(USERS.btManager);
    await approveCount((await getContext())!, { auditId: c.id, approve: true });
    expect(await on("BT-C-10-1")).toBe(17);
    const adj = await prisma.adjustment.findFirstOrThrow({ where: { stockAuditId: c.id } });
    expect([adj.direction, adj.quantity, adj.status]).toEqual([-1, 3, "POSTED"]);
  });
});

describe("roles on the new actions", () => {
  it("VIEWER cannot create a sales order", async () => {
    await signInAs(USERS.btViewer);
    expect(await createSoAction({ customerName: "Nope", lines: [{ productId, quantity: 1 }] })).toMatchObject({
      ok: false,
    });
    expect(await prisma.salesOrder.count({ where: { customerName: "Nope" } })).toBe(0);
  });

  it("a Rich Fill user cannot act on Bond Therapy documents", async () => {
    const rf = await as(USERS.rfAdmin);
    const so = await prisma.salesOrder.findFirstOrThrow({ where: { companyId: ctx.company.id } });
    await expect(generatePickList(rf, { salesOrderId: so.id })).rejects.toThrow(/not found/);
    await expect(
      createSalesOrder(rf, { customerName: "Sneaky", lines: [{ productId, quantity: 1 }] }),
    ).rejects.toThrow();
    expect(await prisma.salesOrder.count({ where: { customerName: "Sneaky" } })).toBe(0);
  });
});
