import { Prisma, type LocationType } from "@prisma/client";
import { HttpError, type Context } from "@/server/auth/context";
import type { Lot } from "@/lib/fefo";
import { parseTileCode, zoneBelongsTo } from "@/lib/tile";
import type { Actor, Tx } from "@/server/stock";

/** Who is acting, for movements and audit rows. */
export const actorOf = (ctx: Context): Actor => ({
  userId: ctx.user.id,
  companyId: ctx.company.id,
  warehouseId: ctx.warehouseId!,
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  requestId: ctx.requestId,
});

/** Tenant ids every new row needs (the tenant client checks they match). */
export const scopeOf = (ctx: Context) => ({ companyId: ctx.company.id, warehouseId: ctx.warehouseId! });

/** For nested line creates: company_id comes from the parent through the composite foreign key. */
export const lineScope = (ctx: Context) => ({ warehouseId: ctx.warehouseId! });

/** Human-readable document number, unique enough per company: PO-261019-7KQ2 */
export function docNo(prefix: string) {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Run a write in one transaction, at most once per idempotency key.
 * A double click, a retry after a timeout, or two tabs submitting the same form
 * all carry the same key: the first one does the work, the rest get its result.
 */
export async function once<T>(
  ctx: Context,
  key: string | undefined,
  action: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const companyId = ctx.company.id;
  const run = () =>
    ctx.db.$transaction(
      async (tx) => {
        if (key) {
          const done = await tx.idempotencyKey.findUnique({ where: { companyId_key: { companyId, key } } });
          if (done) return done.result as T;
          // Claim the key first: a concurrent duplicate blocks on this unique row until we finish.
          await tx.idempotencyKey.create({ data: { companyId, key, action } });
        }
        const out = await fn(tx);
        if (key) {
          await tx.idempotencyKey.update({
            where: { companyId_key: { companyId, key } },
            data: { result: JSON.parse(JSON.stringify(out ?? null)) as Prisma.InputJsonValue },
          });
        }
        return out;
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  try {
    return await run();
  } catch (e) {
    // Lost the race to a duplicate of this very submit: return the winner's result.
    if (
      key &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      String(e.meta?.target).includes("key")
    ) {
      const done = await ctx.db.idempotencyKey.findUnique({ where: { companyId_key: { companyId, key } } });
      if (done) return done.result as T;
    }
    throw e;
  }
}

/** Find one of this company's tiles by its code, with friendly errors. */
export async function tileByCode(tx: Tx, ctx: Context, code: string, allowed?: LocationType[]) {
  const parts = parseTileCode(code);
  if (!parts) throw new HttpError(400, `"${code}" is not a valid tile code (example: ${ctx.company.code}-A-03-1).`);
  if (!zoneBelongsTo(parts.zone, ctx.company.code)) {
    throw new HttpError(400, `Tile ${code.toUpperCase()} is not in a ${ctx.company.name} zone.`);
  }
  const tile = await tx.location.findFirst({ where: { code: code.trim().toUpperCase() } });
  if (!tile) throw new HttpError(404, `Tile ${code.toUpperCase()} does not exist.`);
  if (!tile.isActive) throw new HttpError(400, `Tile ${tile.code} is deactivated.`);
  if (allowed && !allowed.includes(tile.type)) {
    throw new HttpError(
      400,
      `Tile ${tile.code} is a ${tile.type.toLowerCase()} tile; use a ${allowed.map((t) => t.toLowerCase()).join(" or ")} tile.`,
    );
  }
  return tile;
}

/** The company's single tile of a special type (receiving, return, damaged...). */
export async function specialTile(tx: Tx, type: LocationType) {
  const tile = await tx.location.findFirst({ where: { type, isActive: true }, orderBy: { code: "asc" } });
  if (!tile) throw new HttpError(400, `Create an active ${type.toLowerCase()} tile first (Locations).`);
  return tile;
}

/**
 * Units of a product reserved by pick lists that are not dispatched yet,
 * keyed by `${locationId}|${batchId}`.
 */
export async function reservations(tx: Tx, productId?: string) {
  const lines = await tx.pickListLine.findMany({
    where: { productId, pickList: { status: { in: ["OPEN", "IN_PROGRESS", "DONE"] } } },
    select: { id: true, locationId: true, batchId: true, quantity: true, pickedQuantity: true, confirmedAt: true },
  });
  const dispatched = await tx.dispatchLine.groupBy({
    by: ["pickListLineId"],
    where: { pickListLineId: { in: lines.map((l) => l.id) }, dispatch: { status: "POSTED" } },
    _sum: { quantity: true },
  });
  const sent = new Map(dispatched.map((d) => [d.pickListLineId, d._sum.quantity ?? 0]));
  const out = new Map<string, number>();
  for (const l of lines) {
    const held = (l.confirmedAt ? l.pickedQuantity : l.quantity) - (sent.get(l.id) ?? 0);
    if (held > 0) out.set(`${l.locationId}|${l.batchId}`, (out.get(`${l.locationId}|${l.batchId}`) ?? 0) + held);
  }
  return out;
}

/** Pickable lots of a product: on active STORAGE tiles, minus reservations. */
export async function availableLots(tx: Tx, productId: string): Promise<Lot[]> {
  const [balances, reserved] = await Promise.all([
    tx.stockBalance.findMany({ where: { productId, quantity: { gt: 0 } } }),
    reservations(tx, productId),
  ]);
  const [tiles, batches] = await Promise.all([
    tx.location.findMany({ where: { id: { in: balances.map((b) => b.locationId) }, type: "STORAGE", isActive: true } }),
    tx.batch.findMany({ where: { id: { in: balances.flatMap((b) => (b.batchId ? [b.batchId] : [])) } } }),
  ]);
  const tileById = new Map(tiles.map((t) => [t.id, t]));
  const batchById = new Map(batches.map((b) => [b.id, b]));
  return balances
    .filter((b) => tileById.has(b.locationId))
    .map((b) => ({
      batchId: b.batchId,
      batchNo: b.batchId ? (batchById.get(b.batchId)?.batchNo ?? null) : null,
      expiryDate: b.batchId ? (batchById.get(b.batchId)?.expiryDate ?? null) : null,
      locationId: b.locationId,
      locationCode: tileById.get(b.locationId)!.code,
      available: b.quantity - (reserved.get(`${b.locationId}|${b.batchId}`) ?? 0),
    }))
    .filter((l) => l.available > 0);
}

/** Balance of one product/batch on one tile (0 if none). */
export async function balanceAt(tx: Tx, productId: string, locationId: string, batchId: string | null) {
  const b = await tx.stockBalance.findFirst({ where: { productId, locationId, batchId } });
  return b?.quantity ?? 0;
}
