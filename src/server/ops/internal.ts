import { z } from "zod";
import { HttpError, type Context } from "@/server/auth/context";
import { audit } from "@/server/audit";
import { computeVariance } from "@/lib/variance";
import { lockKeys } from "@/server/db/locks";
import { postMovements } from "@/server/stock";
import { getSettings } from "./settings";
import { actorOf, balanceAt, docNo, lineScope, once, scopeOf, specialTile, tileByCode } from "./core";

const qty = z.coerce.number().int("Whole numbers only").min(1, "At least 1").max(1_000_000);
const key = z.string().max(64).optional();

// ------------------------------------------------------------------ transfers

export const transferSchema = z
  .object({
    key,
    productId: z.string().min(1),
    batchId: z.string().nullable().optional(),
    fromCode: z.string().trim().min(4, "Scan or type the source tile"),
    toCode: z.string().trim().min(4, "Scan or type the destination tile"),
    quantity: qty,
    reason: z.string().trim().min(3, "Give a reason").max(200),
  })
  .refine((v) => v.fromCode.toUpperCase() !== v.toCode.toUpperCase(), {
    message: "Source and destination are the same tile",
    path: ["toCode"],
  });

/** Tile to tile: TRANSFER_OUT and TRANSFER_IN commit together, or neither does. */
export async function transferStock(ctx: Context, input: z.input<typeof transferSchema>) {
  const v = transferSchema.parse(input);
  return once(ctx, v.key, "stock.transfer", async (tx) => {
    const from = await tileByCode(tx, ctx, v.fromCode);
    const to = await tileByCode(tx, ctx, v.toCode, ["STORAGE", "QUARANTINE", "DISPATCH"]);
    const batchId = v.batchId ?? null;
    const have = await balanceAt(tx, v.productId, from.id, batchId);
    if (have < v.quantity) throw new HttpError(400, `Only ${have} on ${from.code}.`);
    const ref = { referenceType: "TRANSFER", referenceId: docNo("TR"), reason: v.reason };
    const moves = await postMovements(tx, actorOf(ctx), [
      { type: "TRANSFER_OUT", productId: v.productId, batchId, locationId: from.id, quantity: v.quantity, ...ref },
      { type: "TRANSFER_IN", productId: v.productId, batchId, locationId: to.id, quantity: v.quantity, ...ref },
    ]);
    await audit(
      { ...ctx.auditMeta, action: "stock.transfer", entity: "stock_movement", entityId: moves[0].id, after: v },
      tx,
    );
    return { reference: ref.referenceId };
  });
}

// ------------------------------------------------------------------ returns

export const returnSchema = z.object({
  key,
  salesOrderId: z.string().optional().nullable(),
  customerName: z.string().trim().min(2, "Enter the customer").max(120),
  productId: z.string().min(1),
  batchNo: z.string().trim().max(40).optional().nullable(),
  quantity: qty,
  reason: z.string().trim().min(3, "Give a reason").max(200),
});

/** Customer return: units arrive on the RETURN tile and wait for inspection. */
export async function receiveReturn(ctx: Context, input: z.input<typeof returnSchema>) {
  const v = returnSchema.parse(input);
  return once(ctx, v.key, "return.receive", async (tx) => {
    const tile = await specialTile(tx, "RETURN");
    const batch = v.batchNo
      ? await tx.batch.findUnique({
          where: {
            companyId_productId_batchNo: { companyId: ctx.company.id, productId: v.productId, batchNo: v.batchNo },
          },
        })
      : null;
    if (v.batchNo && !batch) throw new HttpError(404, `Batch ${v.batchNo} not found for this product.`);
    const r = await tx.stockReturn.create({
      data: {
        ...scopeOf(ctx),
        returnNumber: docNo("RT"),
        salesOrderId: v.salesOrderId || null,
        customerName: v.customerName,
        productId: v.productId,
        batchId: batch?.id,
        locationId: tile.id,
        quantity: v.quantity,
        reason: v.reason,
        createdById: ctx.user.id,
      },
    });
    await postMovements(tx, actorOf(ctx), [
      {
        type: "RETURN",
        productId: v.productId,
        batchId: batch?.id,
        locationId: tile.id,
        quantity: v.quantity,
        referenceType: "RETURN",
        referenceId: r.id,
        reason: v.reason,
      },
    ]);
    await audit({ ...ctx.auditMeta, action: "return.receive", entity: "return", entityId: r.id, after: v }, tx);
    return { id: r.id, returnNumber: r.returnNumber };
  });
}

export const inspectSchema = z
  .object({
    key,
    returnId: z.string().min(1),
    disposition: z.enum(["RESTOCK", "DAMAGE", "SEND_BACK"]),
    notes: z.string().trim().max(500).optional(),
    restockTileCode: z.string().trim().optional(),
  })
  .refine((v) => v.disposition !== "RESTOCK" || !!v.restockTileCode, {
    message: "Scan the tile to restock to",
    path: ["restockTileCode"],
  });

/**
 * After inspection: RESTOCK moves the units to a storage tile; SEND_BACK ships
 * them back to the company (OUTWARD); DAMAGE raises a write-off that a
 * WAREHOUSE_MANAGER must approve.
 */
export async function inspectReturn(ctx: Context, input: z.input<typeof inspectSchema>) {
  const v = inspectSchema.parse(input);
  return once(ctx, v.key, "return.inspect", async (tx) => {
    const r = await tx.stockReturn.findUnique({ where: { id: v.returnId } });
    if (!r) throw new HttpError(404, "Return not found.");
    if (r.status !== "RECEIVED") throw new HttpError(409, "This return is already inspected.");
    const base = { productId: r.productId, batchId: r.batchId, quantity: r.quantity };
    let restockLocationId: string | null = null;
    if (v.disposition === "RESTOCK") {
      const to = await tileByCode(tx, ctx, v.restockTileCode!, ["STORAGE"]);
      restockLocationId = to.id;
      const ref = { referenceType: "RETURN", referenceId: r.id, reason: `Restock return ${r.returnNumber}` };
      await postMovements(tx, actorOf(ctx), [
        { type: "TRANSFER_OUT", ...base, locationId: r.locationId, ...ref },
        { type: "TRANSFER_IN", ...base, locationId: to.id, ...ref },
      ]);
    } else if (v.disposition === "SEND_BACK") {
      await postMovements(tx, actorOf(ctx), [
        {
          type: "OUTWARD",
          ...base,
          locationId: r.locationId,
          referenceType: "RETURN_TO_COMPANY",
          referenceId: r.id,
          reason: `Sent back to company: ${r.returnNumber}`,
        },
      ]);
    } else {
      await tx.damage.create({
        data: {
          ...scopeOf(ctx),
          damageNumber: docNo("WO"),
          ...base,
          locationId: r.locationId,
          kind: "DAMAGE",
          reason: `Customer return ${r.returnNumber}: ${v.notes || r.reason}`,
          reportedById: ctx.user.id,
          returnId: r.id,
        },
      });
    }
    await tx.stockReturn.update({
      where: { id: r.id },
      data: {
        disposition: v.disposition,
        inspectionNotes: v.notes,
        restockLocationId,
        inspectedById: ctx.user.id,
        inspectedAt: new Date(),
        status: v.disposition === "DAMAGE" ? "INSPECTED" : "CLOSED",
      },
    });
    await audit(
      { ...ctx.auditMeta, action: "return.inspect", entity: "return", entityId: r.id, before: r, after: v },
      tx,
    );
    return { status: v.disposition === "DAMAGE" ? "awaiting approval" : "closed" };
  });
}

// ------------------------------------------------------------------ damage / expiry write-offs

export const writeOffSchema = z.object({
  key,
  kind: z.enum(["DAMAGE", "EXPIRY"]),
  productId: z.string().min(1),
  batchId: z.string().nullable().optional(),
  tileCode: z.string().trim().min(4, "Scan or type the tile"),
  quantity: qty,
  reason: z.string().trim().min(3, "Give a reason").max(200),
});

/** Report a write-off. Nothing moves until a WAREHOUSE_MANAGER (or above) approves it. */
export async function reportWriteOff(
  ctx: Context,
  input: z.input<typeof writeOffSchema>,
  link?: { receiptLineId: string },
) {
  const v = writeOffSchema.parse(input);
  const r = await reportWriteOffOnce(ctx, v, link);
  // Owner setting: write-offs may skip approval.
  if (!(await getSettings(ctx.db, ctx.company.id)).writeOffApproval) {
    const d = await ctx.db.damage.findUnique({ where: { id: r.id } });
    if (d?.status === "DRAFT") await decideWriteOff(ctx, { id: r.id, approve: true });
  }
  return r;
}

async function reportWriteOffOnce(ctx: Context, v: z.output<typeof writeOffSchema>, link?: { receiptLineId: string }) {
  return once(ctx, v.key, "writeoff.report", async (tx) => {
    if (link) {
      await lockKeys(tx, [`writeoff-line:${link.receiptLineId}`]);
      const dup = await tx.damage.findFirst({
        where: { receiptLineId: link.receiptLineId, status: { not: "CANCELLED" } },
      });
      if (dup) throw new HttpError(409, `Already written off as ${dup.damageNumber}.`);
    }
    const tile = await tileByCode(tx, ctx, v.tileCode);
    const have = await balanceAt(tx, v.productId, tile.id, v.batchId ?? null);
    if (have < v.quantity) throw new HttpError(400, `Only ${have} on ${tile.code}.`);
    const d = await tx.damage.create({
      data: {
        ...scopeOf(ctx),
        damageNumber: docNo("WO"),
        kind: v.kind,
        productId: v.productId,
        batchId: v.batchId ?? null,
        locationId: tile.id,
        quantity: v.quantity,
        reason: v.reason,
        reportedById: ctx.user.id,
        receiptLineId: link?.receiptLineId,
      },
    });
    await audit({ ...ctx.auditMeta, action: "writeoff.report", entity: "damage", entityId: d.id, after: v }, tx);
    return { id: d.id, damageNumber: d.damageNumber };
  });
}

/**
 * One tap from the receipt: write off the cartons that arrived damaged and sit on
 * the DAMAGED tile. Same flow (and approval setting) as any write-off; the
 * write-off is linked to the receipt line, so its photos show with it.
 */
export async function writeOffReceiptDamage(ctx: Context, input: { key?: string; lineId: string }) {
  const line = await ctx.db.inwardReceiptLine.findUnique({
    where: { id: input.lineId },
    include: { inwardReceipt: { select: { receiptNumber: true } } },
  });
  if (!line) throw new HttpError(404, "Receipt line not found.");
  if (line.damagedQuantity <= 0) throw new HttpError(400, "No damaged units on this receipt line.");
  const dup = await ctx.db.damage.findFirst({ where: { receiptLineId: line.id, status: { not: "CANCELLED" } } });
  if (dup) throw new HttpError(409, `Already written off as ${dup.damageNumber}.`);
  const tile = await specialTile(ctx.db, "DAMAGED");
  const have = await balanceAt(ctx.db, line.productId, tile.id, line.batchId);
  const quantity = Math.min(line.damagedQuantity, have);
  if (quantity <= 0) throw new HttpError(400, `The damaged units are no longer on ${tile.code}.`);
  return reportWriteOff(
    ctx,
    {
      key: input.key,
      kind: "DAMAGE",
      productId: line.productId,
      batchId: line.batchId,
      tileCode: tile.code,
      quantity,
      reason: `Damaged on receipt ${line.inwardReceipt.receiptNumber}`,
    },
    { receiptLineId: line.id },
  );
}

export const decideSchema = z.object({
  key,
  id: z.string().min(1),
  approve: z.boolean(),
  note: z.string().trim().max(200).optional(),
});

/** Approve (posts a DAMAGE movement) or reject a write-off. Caller must hold stock.approve. */
export async function decideWriteOff(ctx: Context, input: z.input<typeof decideSchema>) {
  const v = decideSchema.parse(input);
  return once(ctx, v.key, "writeoff.decide", async (tx) => {
    const d = await tx.damage.findUnique({ where: { id: v.id } });
    if (!d) throw new HttpError(404, "Write-off not found.");
    if (d.status !== "DRAFT") throw new HttpError(409, "Already decided.");
    if (v.approve) {
      await postMovements(tx, actorOf(ctx), [
        {
          type: "DAMAGE",
          productId: d.productId,
          batchId: d.batchId,
          locationId: d.locationId,
          quantity: d.quantity,
          referenceType: "WRITE_OFF",
          referenceId: d.id,
          reason: `${d.kind === "EXPIRY" ? "Expiry" : "Damage"} write-off ${d.damageNumber}: ${d.reason}`,
        },
      ]);
      if (d.returnId) await tx.stockReturn.update({ where: { id: d.returnId }, data: { status: "CLOSED" } });
    }
    await tx.damage.update({
      where: { id: d.id },
      data: { status: v.approve ? "POSTED" : "CANCELLED", approvedById: ctx.user.id, approvedAt: new Date() },
    });
    await audit(
      {
        ...ctx.auditMeta,
        action: v.approve ? "writeoff.approve" : "writeoff.reject",
        entity: "damage",
        entityId: d.id,
        before: d,
        after: v,
      },
      tx,
    );
    return { status: v.approve ? "approved" : "rejected" };
  });
}

// ------------------------------------------------------------------ cycle counts

export const countSchema = z.object({
  key,
  tileCodes: z.array(z.string().trim().min(4)).min(1, "Pick at least one tile").max(200),
});

/** Create a count task: snapshot what the system thinks is on each tile. */
export async function createCount(ctx: Context, input: z.input<typeof countSchema>) {
  const v = countSchema.parse(input);
  return once(ctx, v.key, "count.create", async (tx) => {
    const tiles = [];
    for (const c of v.tileCodes) tiles.push(await tileByCode(tx, ctx, c));
    const balances = await tx.stockBalance.findMany({
      where: { locationId: { in: tiles.map((t) => t.id) }, quantity: { gt: 0 } },
    });
    const audit_ = await tx.stockAudit.create({
      data: {
        ...scopeOf(ctx),
        auditNumber: docNo("CC"),
        createdById: ctx.user.id,
        lines: {
          create: balances.map((b) => ({
            ...lineScope(ctx),
            productId: b.productId,
            batchId: b.batchId,
            locationId: b.locationId,
            systemQuantity: b.quantity,
          })),
        },
      },
    });
    await audit({ ...ctx.auditMeta, action: "count.create", entity: "stock_audit", entityId: audit_.id, after: v }, tx);
    return { id: audit_.id, auditNumber: audit_.auditNumber, lines: balances.length };
  });
}

export const enterCountsSchema = z.object({
  key,
  auditId: z.string().min(1),
  submit: z.boolean().default(false),
  lines: z.array(
    z.object({
      lineId: z.string(),
      counted: z.coerce.number().int().min(0).nullable(),
      reason: z.string().trim().max(200).optional().nullable(),
    }),
  ),
});

/** Enter physical counts; with submit=true every variance must carry a reason. */
export async function enterCounts(ctx: Context, input: z.input<typeof enterCountsSchema>) {
  const v = enterCountsSchema.parse(input);
  const r = await enterCountsOnce(ctx, v);
  // Owner setting: counts may adjust stock without a second approval.
  if (r.status === "SUBMITTED" && !(await getSettings(ctx.db, ctx.company.id)).countApproval) {
    await approveCount(ctx, { auditId: v.auditId, approve: true });
    return { ...r, status: "CLOSED" };
  }
  return r;
}

async function enterCountsOnce(ctx: Context, v: z.output<typeof enterCountsSchema>) {
  return once(ctx, v.key, "count.enter", async (tx) => {
    const a = await tx.stockAudit.findUnique({ where: { id: v.auditId }, include: { lines: true } });
    if (!a) throw new HttpError(404, "Count not found.");
    if (a.status !== "OPEN" && a.status !== "COUNTING") throw new HttpError(409, `Count is ${a.status.toLowerCase()}.`);
    for (const l of v.lines) {
      if (!a.lines.some((x) => x.id === l.lineId)) throw new HttpError(404, "Count line not found.");
      await tx.stockAuditLine.update({
        where: { id: l.lineId },
        data: { countedQuantity: l.counted, varianceReason: l.reason || null },
      });
    }
    const lines = await tx.stockAuditLine.findMany({ where: { stockAuditId: a.id } });
    const vr = computeVariance(lines);
    if (v.submit && !vr.ready) {
      throw new HttpError(
        400,
        vr.uncounted ? `${vr.uncounted} line(s) not counted yet.` : `${vr.missingReasons} variance(s) need a reason.`,
      );
    }
    await tx.stockAudit.update({
      where: { id: a.id },
      data: { status: v.submit ? "SUBMITTED" : "COUNTING", submittedById: v.submit ? ctx.user.id : null },
    });
    await audit(
      {
        ...ctx.auditMeta,
        action: v.submit ? "count.submit" : "count.enter",
        entity: "stock_audit",
        entityId: a.id,
        after: v,
      },
      tx,
    );
    return { status: v.submit ? "SUBMITTED" : "COUNTING", gain: vr.gain, loss: vr.loss };
  });
}

/** Manager approval: each variance becomes an Adjustment and an ADJUSTMENT movement. */
export async function approveCount(ctx: Context, input: { key?: string; auditId: string; approve: boolean }) {
  return once(ctx, input.key, "count.approve", async (tx) => {
    const a = await tx.stockAudit.findUnique({ where: { id: input.auditId }, include: { lines: true } });
    if (!a) throw new HttpError(404, "Count not found.");
    if (a.status !== "SUBMITTED") throw new HttpError(409, "Only a submitted count can be approved.");
    if (!input.approve) {
      await tx.stockAudit.update({ where: { id: a.id }, data: { status: "COUNTING" } });
      return { adjustments: 0 };
    }
    const rows = computeVariance(a.lines).rows.filter((r) => r.variance);
    for (const r of rows) {
      const line = a.lines.find((l) => l.id === r.id)!;
      const direction = r.variance! > 0 ? 1 : -1;
      const adj = await tx.adjustment.create({
        data: {
          ...scopeOf(ctx),
          adjustmentNumber: docNo("ADJ"),
          stockAuditId: a.id,
          productId: line.productId,
          batchId: line.batchId,
          locationId: line.locationId,
          direction,
          quantity: Math.abs(r.variance!),
          reason: line.varianceReason!,
          status: "POSTED",
          createdById: a.submittedById ?? ctx.user.id,
          approvedById: ctx.user.id,
          approvedAt: new Date(),
        },
      });
      await postMovements(tx, actorOf(ctx), [
        {
          type: "ADJUSTMENT",
          direction,
          productId: line.productId,
          batchId: line.batchId,
          locationId: line.locationId,
          quantity: adj.quantity,
          referenceType: "ADJUSTMENT",
          referenceId: adj.id,
          reason: `Cycle count ${a.auditNumber}: ${line.varianceReason}`,
        },
      ]);
    }
    await tx.stockAudit.update({
      where: { id: a.id },
      data: { status: "CLOSED", closedAt: new Date(), approvedById: ctx.user.id },
    });
    await audit(
      {
        ...ctx.auditMeta,
        action: "count.approve",
        entity: "stock_audit",
        entityId: a.id,
        after: { adjustments: rows.length },
      },
      tx,
    );
    return { adjustments: rows.length };
  });
}
