import { z } from "zod";
import { HttpError, type Context } from "@/server/auth/context";
import { audit } from "@/server/audit";
import { allocateFefo } from "@/lib/fefo";
import { parseTileCode } from "@/lib/tile";
import { lockKeys } from "@/server/db/locks";
import { postMovements, postReversal, type Tx } from "@/server/stock";
import { actorOf, availableLots, docNo, lineScope, once, scopeOf } from "./core";

const qty = z.coerce.number().int("Whole numbers only");

export const soSchema = z.object({
  key: z.string().max(64).optional(),
  customerName: z.string().trim().min(2, "Enter the customer").max(120),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: qty.min(1, "At least 1").max(1_000_000),
        unitPrice: z.coerce.number().min(0).default(0),
      }),
    )
    .min(1, "Add at least one product")
    .refine((ls) => new Set(ls.map((l) => l.productId)).size === ls.length, "Each product only once per order"),
});

export async function createSalesOrder(ctx: Context, input: z.input<typeof soSchema>) {
  const v = soSchema.parse(input);
  return once(ctx, v.key, "so.create", async (tx) => {
    const so = await tx.salesOrder.create({
      data: {
        ...scopeOf(ctx),
        orderNumber: docNo("SO"),
        customerName: v.customerName,
        status: "CONFIRMED",
        createdById: ctx.user.id,
        lines: { create: v.lines.map((l) => ({ ...lineScope(ctx), ...l })) },
      },
    });
    await audit({ ...ctx.auditMeta, action: "so.create", entity: "sales_order", entityId: so.id, after: v }, tx);
    return { id: so.id, orderNumber: so.orderNumber };
  });
}

/** Quantities already allocated to (non-cancelled) pick lists, per product, for one order. */
async function allocatedFor(tx: Tx, salesOrderId: string) {
  const lines = await tx.pickListLine.findMany({
    where: { pickList: { salesOrderId, status: { not: "CANCELLED" } } },
    select: { productId: true, quantity: true, pickedQuantity: true, confirmedAt: true },
  });
  const m = new Map<string, number>();
  // A short-picked line only keeps what was actually picked; the rest can be re-allocated.
  for (const l of lines)
    m.set(l.productId, (m.get(l.productId) ?? 0) + (l.confirmedAt ? l.pickedQuantity : l.quantity));
  return m;
}

/**
 * Build a pick list with FEFO: earliest expiry first, never expired stock, never
 * stock already reserved by another pick list. Per-product locks stop two pick
 * lists from being promised the same units.
 */
export async function generatePickList(ctx: Context, input: { key?: string; salesOrderId: string }) {
  return once(ctx, input.key, "pick.generate", async (tx) => {
    const so = await tx.salesOrder.findUnique({
      where: { id: input.salesOrderId },
      include: { lines: { include: { product: true } } },
    });
    if (!so) throw new HttpError(404, "Sales order not found.");
    if (!["CONFIRMED", "PICKING", "PACKED"].includes(so.status))
      throw new HttpError(400, `Order ${so.orderNumber} is ${so.status.toLowerCase()}.`);
    await lockKeys(
      tx,
      so.lines.map((l) => `alloc:${ctx.company.id}:${l.productId}`),
    );

    const already = await allocatedFor(tx, so.id);
    const plan: { productId: string; lots: ReturnType<typeof allocateFefo>["allocations"] }[] = [];
    const shortages: { sku: string; short: number }[] = [];
    for (const l of so.lines) {
      const need = l.quantity - (already.get(l.productId) ?? 0);
      if (need <= 0) continue;
      const r = allocateFefo(await availableLots(tx, l.productId), need);
      if (r.allocations.length) plan.push({ productId: l.productId, lots: r.allocations });
      if (r.short) shortages.push({ sku: l.product.sku, short: r.short });
    }
    if (!plan.length) {
      throw new HttpError(
        400,
        shortages.length
          ? `No pickable stock for: ${shortages.map((s) => s.sku).join(", ")}.`
          : "Everything on this order is already on a pick list.",
      );
    }

    const pick = await tx.pickList.create({
      data: {
        ...scopeOf(ctx),
        pickNumber: docNo("PL"),
        salesOrderId: so.id,
        lines: {
          create: plan.flatMap((p) =>
            p.lots.map((a) => ({
              ...lineScope(ctx),
              productId: p.productId,
              batchId: a.batchId,
              locationId: a.locationId,
              quantity: a.quantity,
            })),
          ),
        },
      },
    });
    await tx.salesOrder.update({ where: { id: so.id }, data: { status: "PICKING" } });
    await audit(
      { ...ctx.auditMeta, action: "pick.generate", entity: "pick_list", entityId: pick.id, after: { plan, shortages } },
      tx,
    );
    return { id: pick.id, pickNumber: pick.pickNumber, shortages };
  });
}

export const confirmPickSchema = z.object({
  key: z.string().max(64).optional(),
  lineId: z.string().min(1),
  tileCode: z.string().trim().min(4, "Scan or type the tile code"),
  quantity: qty.min(0, "Cannot be negative"),
  shortReason: z.string().trim().max(200).optional(),
});

/** Picker confirms a line: must be at the right tile; picking fewer needs a reason (short pick). */
export async function confirmPick(ctx: Context, input: z.input<typeof confirmPickSchema>) {
  const v = confirmPickSchema.parse(input);
  return once(ctx, v.key, "pick.confirm", async (tx) => {
    const line = await tx.pickListLine.findUnique({
      where: { id: v.lineId },
      include: { location: true, pickList: true },
    });
    if (!line) throw new HttpError(404, "Pick line not found.");
    if (line.pickList.status === "CANCELLED" || line.pickList.status === "DONE")
      throw new HttpError(400, `Pick list is ${line.pickList.status.toLowerCase()}.`);
    if (line.confirmedAt) throw new HttpError(409, "This line is already confirmed.");
    if (parseTileCode(v.tileCode) == null || v.tileCode.toUpperCase() !== line.location.code) {
      throw new HttpError(400, `Wrong tile. Pick from ${line.location.code}.`);
    }
    if (v.quantity > line.quantity) throw new HttpError(400, `Pick at most ${line.quantity}.`);
    if (v.quantity < line.quantity && !v.shortReason)
      throw new HttpError(400, "Picking fewer than asked: give a reason (short pick).");

    await tx.pickListLine.update({
      where: { id: line.id },
      data: {
        pickedQuantity: v.quantity,
        confirmedAt: new Date(),
        confirmedById: ctx.user.id,
        shortReason: v.quantity < line.quantity ? v.shortReason : null,
      },
    });
    const open = await tx.pickListLine.count({ where: { pickListId: line.pickListId, confirmedAt: null } });
    await tx.pickList.update({ where: { id: line.pickListId }, data: { status: open ? "IN_PROGRESS" : "DONE" } });
    await audit(
      { ...ctx.auditMeta, action: "pick.confirm", entity: "pick_list_line", entityId: line.id, after: v },
      tx,
    );
    return { done: open === 0, short: line.quantity - v.quantity };
  });
}

/** Picked units not dispatched yet, per pick line (for one order). */
async function readyToShip(tx: Tx, salesOrderId: string) {
  const lines = await tx.pickListLine.findMany({
    where: {
      pickList: { salesOrderId, status: { not: "CANCELLED" } },
      confirmedAt: { not: null },
      pickedQuantity: { gt: 0 },
    },
    include: { product: { select: { sku: true, name: true } }, batch: true, location: true },
  });
  const sent = await tx.dispatchLine.groupBy({
    by: ["pickListLineId"],
    where: { pickListLineId: { in: lines.map((l) => l.id) }, dispatch: { status: "POSTED" } },
    _sum: { quantity: true },
  });
  const sentBy = new Map(sent.map((s) => [s.pickListLineId, s._sum.quantity ?? 0]));
  return lines
    .map((l) => ({ ...l, remaining: l.pickedQuantity - (sentBy.get(l.id) ?? 0) }))
    .filter((l) => l.remaining > 0);
}

export const packSchema = z.object({ key: z.string().max(64).optional(), salesOrderId: z.string().min(1) });

/** Packing check: every pick list of the order is fully confirmed. */
export async function packOrder(ctx: Context, input: z.input<typeof packSchema>) {
  const v = packSchema.parse(input);
  return once(ctx, v.key, "so.pack", async (tx) => {
    const so = await tx.salesOrder.findUnique({
      where: { id: v.salesOrderId },
      include: { pickLists: { include: { lines: true } } },
    });
    if (!so) throw new HttpError(404, "Sales order not found.");
    const open = so.pickLists
      .filter((p) => p.status !== "CANCELLED")
      .flatMap((p) => p.lines)
      .filter((l) => !l.confirmedAt);
    if (open.length) throw new HttpError(400, `${open.length} pick line(s) are not confirmed yet.`);
    if (!(await readyToShip(tx, so.id)).length) throw new HttpError(400, "Nothing picked to pack.");
    await tx.salesOrder.update({ where: { id: so.id }, data: { status: "PACKED" } });
    await audit({ ...ctx.auditMeta, action: "so.pack", entity: "sales_order", entityId: so.id }, tx);
    return { ok: true };
  });
}

export const dispatchSchema = z.object({
  key: z.string().max(64).optional(),
  salesOrderId: z.string().min(1),
  vehicleNo: z.string().trim().min(4, "Enter the vehicle number").max(20),
  lrNumber: z.string().trim().max(40).optional(),
  transporter: z.string().trim().max(80).optional(),
  /** Optional partial dispatch: pick line id -> quantity. Default: everything picked. */
  lines: z.array(z.object({ pickListLineId: z.string(), quantity: qty.min(1) })).optional(),
});

/**
 * Confirm dispatch. This is the ONLY place outward stock leaves: OUTWARD
 * movements from the picked tiles, in one transaction, with the order locked so
 * two dispatches cannot ship the same units.
 */
export async function dispatchOrder(ctx: Context, input: z.input<typeof dispatchSchema>) {
  const v = dispatchSchema.parse(input);
  return once(ctx, v.key, "dispatch.confirm", async (tx) => {
    await lockKeys(tx, [`dispatch:${ctx.company.id}:${v.salesOrderId}`]);
    const so = await tx.salesOrder.findUnique({ where: { id: v.salesOrderId }, include: { lines: true } });
    if (!so) throw new HttpError(404, "Sales order not found.");
    if (so.status !== "PACKED" && so.status !== "PICKING")
      throw new HttpError(400, `Order ${so.orderNumber} is ${so.status.toLowerCase()}; pack it first.`);

    const ready = await readyToShip(tx, so.id);
    const want = v.lines ? new Map(v.lines.map((l) => [l.pickListLineId, l.quantity])) : null;
    const ship = ready
      .map((l) => ({ line: l, quantity: want ? Math.min(want.get(l.id) ?? 0, l.remaining) : l.remaining }))
      .filter((s) => s.quantity > 0);
    if (want)
      for (const [id, q] of want)
        if (q > (ready.find((r) => r.id === id)?.remaining ?? 0))
          throw new HttpError(400, "Cannot dispatch more than was picked.");
    if (!ship.length) throw new HttpError(400, "Nothing ready to dispatch.");

    const dispatch = await tx.dispatch.create({
      data: {
        ...scopeOf(ctx),
        dispatchNumber: docNo("DC"),
        salesOrderId: so.id,
        status: "POSTED",
        vehicleNo: v.vehicleNo.toUpperCase(),
        lrNumber: v.lrNumber,
        transporter: v.transporter,
        packedAt: new Date(),
        dispatchedAt: new Date(),
        createdById: ctx.user.id,
        lines: {
          create: ship.map((s) => ({
            ...lineScope(ctx),
            productId: s.line.productId,
            batchId: s.line.batchId,
            locationId: s.line.locationId,
            pickListLineId: s.line.id,
            quantity: s.quantity,
          })),
        },
      },
    });
    await postMovements(
      tx,
      actorOf(ctx),
      ship.map((s) => ({
        type: "OUTWARD" as const,
        productId: s.line.productId,
        batchId: s.line.batchId,
        locationId: s.line.locationId,
        quantity: s.quantity,
        referenceType: "DISPATCH",
        referenceId: dispatch.id,
        reason: `Dispatch ${dispatch.dispatchNumber} for ${so.orderNumber}`,
      })),
    );
    await refreshOrderStatus(tx, so.id);
    await audit(
      { ...ctx.auditMeta, action: "dispatch.confirm", entity: "dispatch", entityId: dispatch.id, after: v },
      tx,
    );
    return { id: dispatch.id, dispatchNumber: dispatch.dispatchNumber };
  });
}

/** DISPATCHED when every order line has fully left; otherwise back to PACKED / PICKING. */
async function refreshOrderStatus(tx: Tx, salesOrderId: string) {
  const so = await tx.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId }, include: { lines: true } });
  const shipped = await tx.dispatchLine.groupBy({
    by: ["productId"],
    where: { dispatch: { salesOrderId, status: "POSTED" } },
    _sum: { quantity: true },
  });
  const by = new Map(shipped.map((s) => [s.productId, s._sum.quantity ?? 0]));
  const all = so.lines.every((l) => (by.get(l.productId) ?? 0) >= l.quantity);
  const pending = (await readyToShip(tx, salesOrderId)).length > 0;
  await tx.salesOrder.update({
    where: { id: salesOrderId },
    data: { status: all ? "DISPATCHED" : pending ? "PACKED" : "PICKING" },
  });
}

export const cancelDispatchSchema = z.object({
  key: z.string().max(64).optional(),
  dispatchId: z.string().min(1),
  reason: z.string().trim().min(3, "Give a reason").max(200),
});

/** Undo a dispatch: reversing entries put the stock back on the same tiles; the original rows stay. */
export async function cancelDispatch(ctx: Context, input: z.input<typeof cancelDispatchSchema>) {
  const v = cancelDispatchSchema.parse(input);
  return once(ctx, v.key, "dispatch.cancel", async (tx) => {
    const d = await tx.dispatch.findUnique({ where: { id: v.dispatchId } });
    if (!d) throw new HttpError(404, "Dispatch not found.");
    if (d.status !== "POSTED") throw new HttpError(400, "Only a posted dispatch can be cancelled.");
    const moves = await tx.stockMovement.findMany({
      where: { referenceType: "DISPATCH", referenceId: d.id, reversalOfId: null, reversedBy: { is: null } },
    });
    for (const m of moves)
      await postReversal(tx, actorOf(ctx), m.id, `Cancel dispatch ${d.dispatchNumber}: ${v.reason}`);
    await tx.dispatch.update({
      where: { id: d.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: v.reason },
    });
    await refreshOrderStatus(tx, d.salesOrderId);
    await audit(
      { ...ctx.auditMeta, action: "dispatch.cancel", entity: "dispatch", entityId: d.id, before: d, after: v },
      tx,
    );
    return { reversed: moves.length };
  });
}

export const cancelSoSchema = z.object({
  key: z.string().max(64).optional(),
  salesOrderId: z.string().min(1),
  reason: z.string().trim().min(3, "Give a reason").max(200),
});

export async function cancelSalesOrder(ctx: Context, raw: z.input<typeof cancelSoSchema>) {
  const input = cancelSoSchema.parse(raw);
  return once(ctx, input.key, "so.cancel", async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: input.salesOrderId }, include: { dispatches: true } });
    if (!so) throw new HttpError(404, "Sales order not found.");
    if (so.dispatches.some((d) => d.status === "POSTED")) throw new HttpError(400, "Cancel its dispatches first.");
    if (so.status === "CANCELLED") return { ok: true };
    await tx.pickList.updateMany({
      where: { salesOrderId: so.id, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED" },
    });
    await tx.salesOrder.update({ where: { id: so.id }, data: { status: "CANCELLED" } });
    await audit(
      {
        ...ctx.auditMeta,
        action: "so.cancel",
        entity: "sales_order",
        entityId: so.id,
        after: { reason: input.reason },
      },
      tx,
    );
    return { ok: true };
  });
}
