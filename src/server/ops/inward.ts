import { z } from "zod";
import { HttpError, type Context } from "@/server/auth/context";
import { audit } from "@/server/audit";
import { suggestPutaway } from "@/lib/putaway";
import { lockKeys } from "@/server/db/locks";
import { postMovements, type Tx } from "@/server/stock";
import { actorOf, docNo, lineScope, once, scopeOf, specialTile, tileByCode } from "./core";

const qty = z.coerce.number().int("Whole numbers only").min(0, "Cannot be negative").max(1_000_000);
const date = z
  .preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date("Enter a valid date").nullable())
  .optional()
  .transform((v) => v ?? null);

export const poSchema = z.object({
  key: z.string().max(64).optional(),
  supplierName: z.string().trim().min(2, "Enter the supplier").max(120),
  expectedDate: date,
  notes: z.string().max(1000).optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: qty.min(1, "At least 1"),
        unitPrice: z.coerce.number().min(0).default(0),
      }),
    )
    .min(1, "Add at least one product"),
});

export async function createPurchaseOrder(ctx: Context, input: z.input<typeof poSchema>) {
  const v = poSchema.parse(input);
  return once(ctx, v.key, "po.create", async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        ...scopeOf(ctx),
        poNumber: docNo("PO"),
        supplierName: v.supplierName,
        expectedDate: v.expectedDate,
        notes: v.notes,
        status: "ORDERED",
        createdById: ctx.user.id,
        lines: {
          create: v.lines.map((l) => ({
            ...lineScope(ctx),
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
    });
    await audit({ ...ctx.auditMeta, action: "po.create", entity: "purchase_order", entityId: po.id, after: v }, tx);
    return { id: po.id, poNumber: po.poNumber };
  });
}

export const receiptSchema = z
  .object({
    key: z.string().max(64).optional(),
    purchaseOrderId: z.string().optional().nullable(),
    lines: z
      .array(
        z.object({
          productId: z.string().min(1),
          expected: qty.optional().nullable(),
          received: qty,
          damaged: qty.default(0),
          batchNo: z.string().trim().max(40).optional().nullable(),
          mfgDate: date,
          expiryDate: date,
        }),
      )
      .min(1, "Add at least one line"),
  })
  .superRefine((v, c) =>
    v.lines.forEach((l, i) => {
      if (l.received + l.damaged <= 0)
        c.addIssue({ code: "custom", path: ["lines", i, "received"], message: "Enter received or damaged quantity" });
      if (l.expiryDate && l.mfgDate && l.expiryDate < l.mfgDate)
        c.addIssue({
          code: "custom",
          path: ["lines", i, "expiryDate"],
          message: "Expiry is before manufacturing date",
        });
    }),
  );

/**
 * Record what actually arrived. Good units go to the RECEIVING tile (not yet
 * pickable), damaged units straight to the DAMAGED tile. Shortage is recorded.
 */
export async function receiveGoods(ctx: Context, input: z.input<typeof receiptSchema>) {
  const v = receiptSchema.parse(input);
  return once(ctx, v.key, "inward.receive", async (tx) => {
    const po = v.purchaseOrderId
      ? await tx.purchaseOrder.findUnique({ where: { id: v.purchaseOrderId }, include: { lines: true } })
      : null;
    if (v.purchaseOrderId && !po) throw new HttpError(404, "Purchase order not found.");
    if (po && (po.status === "RECEIVED" || po.status === "CANCELLED"))
      throw new HttpError(400, `PO ${po.poNumber} is ${po.status.toLowerCase()}.`);

    const products = await tx.product.findMany({ where: { id: { in: v.lines.map((l) => l.productId) } } });
    const productById = new Map(products.map((p) => [p.id, p]));
    const [receiving, damagedTile] = await Promise.all([specialTile(tx, "RECEIVING"), specialTile(tx, "DAMAGED")]);

    const receipt = await tx.inwardReceipt.create({
      data: {
        ...scopeOf(ctx),
        receiptNumber: docNo("GRN"),
        purchaseOrderId: po?.id,
        status: "POSTED",
        receivedById: ctx.user.id,
      },
    });

    for (const [i, l] of v.lines.entries()) {
      const p = productById.get(l.productId);
      if (!p) throw new HttpError(404, `Line ${i + 1}: product not found.`);
      if (p.expiryTracked && (!l.batchNo || !l.expiryDate))
        throw new HttpError(400, `Line ${i + 1} (${p.sku}): batch number and expiry date are required.`);
      const batch = l.batchNo
        ? await tx.batch.upsert({
            where: { companyId_productId_batchNo: { companyId: ctx.company.id, productId: p.id, batchNo: l.batchNo } },
            update: {},
            create: {
              ...scopeOf(ctx),
              productId: p.id,
              batchNo: l.batchNo,
              mfgDate: l.mfgDate,
              expiryDate: l.expiryDate,
            },
          })
        : null;
      const expected = l.expected ?? po?.lines.find((x) => x.productId === p.id)?.quantity ?? null;
      const short = expected == null ? 0 : Math.max(0, expected - l.received - l.damaged);
      await tx.inwardReceiptLine.create({
        data: {
          ...scopeOf(ctx),
          inwardReceiptId: receipt.id,
          productId: p.id,
          batchId: batch?.id,
          locationId: receiving.id,
          quantity: l.received,
          expectedQuantity: expected,
          damagedQuantity: l.damaged,
          shortQuantity: short,
        },
      });
      const ref = { referenceType: "INWARD_RECEIPT", referenceId: receipt.id };
      await postMovements(tx, actorOf(ctx), [
        {
          type: "INWARD",
          productId: p.id,
          batchId: batch?.id,
          locationId: receiving.id,
          quantity: l.received,
          ...ref,
          reason: `GRN ${receipt.receiptNumber}`,
        },
        {
          type: "INWARD",
          productId: p.id,
          batchId: batch?.id,
          locationId: damagedTile.id,
          quantity: l.damaged,
          ...ref,
          reason: `Damaged on arrival, GRN ${receipt.receiptNumber}`,
        },
      ]);
    }

    if (po) await updatePoStatus(tx, po.id);
    await audit(
      { ...ctx.auditMeta, action: "inward.receive", entity: "inward_receipt", entityId: receipt.id, after: v },
      tx,
    );
    return { id: receipt.id, receiptNumber: receipt.receiptNumber };
  });
}

async function updatePoStatus(tx: Tx, poId: string) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { lines: true } });
  const got = await tx.inwardReceiptLine.groupBy({
    by: ["productId"],
    where: { inwardReceipt: { purchaseOrderId: poId, status: "POSTED" } },
    _sum: { quantity: true, damagedQuantity: true },
  });
  const done = (pid: string) =>
    got
      .filter((g) => g.productId === pid)
      .reduce((s, g) => s + (g._sum.quantity ?? 0) + (g._sum.damagedQuantity ?? 0), 0);
  const complete = po.lines.every((l) => done(l.productId) >= l.quantity);
  await tx.purchaseOrder.update({
    where: { id: poId },
    data: { status: complete ? "RECEIVED" : "PARTIALLY_RECEIVED" },
  });
}

/** Lines whose good units still sit on the receiving tile. */
export function putawayQueue(ctx: Context) {
  return ctx.db.inwardReceiptLine.findMany({
    where: { putawayAt: null, quantity: { gt: 0 } },
    include: {
      product: { select: { sku: true, name: true, defaultLocationId: true } },
      batch: true,
      inwardReceipt: { select: { receiptNumber: true, receivedAt: true } },
    },
    orderBy: { inwardReceipt: { receivedAt: "asc" } },
    take: 200,
  });
}

/** Where should this receipt line go? (default tile first, else nearest free tile in the company's zones) */
export async function suggestFor(ctx: Context, lineId: string) {
  const line = await ctx.db.inwardReceiptLine.findUnique({ where: { id: lineId }, include: { product: true } });
  if (!line) throw new HttpError(404, "Receipt line not found.");
  const [tiles, sums] = await Promise.all([
    ctx.db.location.findMany({ where: { type: "STORAGE", isActive: true } }),
    ctx.db.stockBalance.groupBy({ by: ["locationId"], _sum: { quantity: true } }),
  ]);
  const units = new Map(sums.map((s) => [s.locationId, s._sum.quantity ?? 0]));
  const tile = suggestPutaway({
    tiles: tiles.map((t) => ({ ...t, units: units.get(t.id) ?? 0 })),
    companyCode: ctx.company.code,
    quantity: line.quantity,
    defaultLocationId: line.product.defaultLocationId,
  });
  return tile ? { id: tile.id, code: tile.code } : null;
}

export const putawaySchema = z.object({
  key: z.string().max(64).optional(),
  lineId: z.string().min(1),
  tileCode: z.string().trim().min(4, "Scan or type the tile code"),
});

/**
 * Confirm putaway by scanning/typing the destination tile. Moves the units from
 * RECEIVING to that tile (TRANSFER_OUT + TRANSFER_IN together). Only now are they pickable.
 */
export async function confirmPutaway(ctx: Context, input: z.input<typeof putawaySchema>) {
  const v = putawaySchema.parse(input);
  return once(ctx, v.key, "inward.putaway", async (tx) => {
    await lockKeys(tx, [`putaway:${v.lineId}`]);
    const line = await tx.inwardReceiptLine.findUnique({ where: { id: v.lineId } });
    if (!line) throw new HttpError(404, "Receipt line not found.");
    if (line.putawayAt) throw new HttpError(409, "This line is already put away.");
    const tile = await tileByCode(tx, ctx, v.tileCode, ["STORAGE"]);
    if (tile.capacity != null) {
      const agg = await tx.stockBalance.aggregate({ where: { locationId: tile.id }, _sum: { quantity: true } });
      if ((agg._sum.quantity ?? 0) + line.quantity > tile.capacity) {
        throw new HttpError(
          400,
          `Tile ${tile.code} has room for ${tile.capacity - (agg._sum.quantity ?? 0)} more units only.`,
        );
      }
    }
    const ref = { referenceType: "PUTAWAY", referenceId: line.id, reason: `Putaway to ${tile.code}` };
    await postMovements(tx, actorOf(ctx), [
      {
        type: "TRANSFER_OUT",
        productId: line.productId,
        batchId: line.batchId,
        locationId: line.locationId,
        quantity: line.quantity,
        ...ref,
      },
      {
        type: "TRANSFER_IN",
        productId: line.productId,
        batchId: line.batchId,
        locationId: tile.id,
        quantity: line.quantity,
        ...ref,
      },
    ]);
    await tx.inwardReceiptLine.update({
      where: { id: line.id },
      data: { putawayLocationId: tile.id, putawayAt: new Date(), putawayById: ctx.user.id },
    });
    await audit(
      {
        ...ctx.auditMeta,
        action: "inward.putaway",
        entity: "inward_receipt_line",
        entityId: line.id,
        after: { tile: tile.code, quantity: line.quantity },
      },
      tx,
    );
    return { tileCode: tile.code, quantity: line.quantity };
  });
}

// ------------------------------------------------------------------ damage photos

const PHOTO_TYPES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Attach damage photos to a receipt. Type is checked by content (magic bytes), not just the name. */
export async function attachReceiptPhotos(
  ctx: Context,
  receiptId: string,
  files: { name: string; type: string; bytes: Buffer }[],
) {
  const receipt = await ctx.db.inwardReceipt.findUnique({ where: { id: receiptId } });
  if (!receipt) throw new HttpError(404, "Receipt not found.");
  if (files.length > 10) throw new HttpError(400, "At most 10 photos per receipt.");
  for (const f of files) {
    const magic = PHOTO_TYPES[f.type];
    if (!magic || !magic.every((b, i) => f.bytes[i] === b))
      throw new HttpError(415, `${f.name}: only JPG, PNG or WebP images.`);
    if (f.bytes.length > MAX_PHOTO_BYTES) throw new HttpError(413, `${f.name} is larger than 2 MB.`);
  }
  await ctx.db.attachment.createMany({
    data: files.map((f) => ({
      companyId: ctx.company.id,
      entity: "inward_receipt",
      entityId: receiptId,
      fileName: f.name.slice(0, 120),
      mimeType: f.type,
      size: f.bytes.length,
      data: new Uint8Array(f.bytes),
      uploadedById: ctx.user.id,
    })),
  });
  await audit({
    ...ctx.auditMeta,
    action: "inward.photos",
    entity: "inward_receipt",
    entityId: receiptId,
    after: { count: files.length },
  });
  return { count: files.length };
}
