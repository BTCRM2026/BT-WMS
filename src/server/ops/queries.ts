import type { Context } from "@/server/auth/context";

/** Product/batch lots currently on tiles, for pickers in transfer and write-off forms. */
export async function lotOptions(ctx: Context) {
  const balances = await ctx.db.stockBalance.findMany({ where: { quantity: { gt: 0 } }, take: 5000 });
  const [products, batches, tiles] = await Promise.all([
    ctx.db.product.findMany({
      where: { id: { in: [...new Set(balances.map((b) => b.productId))] } },
      select: { id: true, sku: true, name: true },
    }),
    ctx.db.batch.findMany({
      where: { id: { in: balances.flatMap((b) => (b.batchId ? [b.batchId] : [])) } },
      select: { id: true, batchNo: true, expiryDate: true },
    }),
    ctx.db.location.findMany({
      where: { id: { in: [...new Set(balances.map((b) => b.locationId))] } },
      select: { id: true, code: true },
    }),
  ]);
  const p = new Map(products.map((x) => [x.id, x]));
  const b = new Map(batches.map((x) => [x.id, x]));
  const l = new Map(tiles.map((x) => [x.id, x]));
  return balances
    .map((x) => ({
      key: `${x.productId}|${x.batchId ?? ""}|${x.locationId}`,
      productId: x.productId,
      batchId: x.batchId,
      tileCode: l.get(x.locationId)?.code ?? "",
      label: `${l.get(x.locationId)?.code} · ${p.get(x.productId)?.sku} ${p.get(x.productId)?.name} · ${x.batchId ? b.get(x.batchId)?.batchNo : "no batch"} · ${x.quantity}`,
      quantity: x.quantity,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
export type LotOption = Awaited<ReturnType<typeof lotOptions>>[number];
