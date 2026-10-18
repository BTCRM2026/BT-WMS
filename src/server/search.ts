import type { Context } from "@/server/auth/context";
import { stockByProduct } from "@/server/insights";

/** Global search across what this user may see. Tenant-scoped through ctx.db. */
export async function globalSearch(ctx: Context, raw: string) {
  const q = raw.trim().slice(0, 64);
  if (q.length < 2) return null;
  const like = { contains: q, mode: "insensitive" as const };
  const take = 8;
  const none = Promise.resolve([]);

  const [products, tiles, batches, pos, sos] = await Promise.all([
    ctx.can("products.view")
      ? ctx.db.product.findMany({
          where: { OR: [{ sku: like }, { name: like }, { barcode: like }] },
          take,
          select: { id: true, sku: true, name: true },
        })
      : none,
    ctx.can("locations.view")
      ? ctx.db.location.findMany({ where: { code: like }, take, select: { id: true, code: true, type: true } })
      : none,
    ctx.can("stock.view")
      ? ctx.db.batch.findMany({
          where: { batchNo: like },
          take,
          select: { id: true, batchNo: true, product: { select: { name: true } } },
        })
      : none,
    ctx.can("purchase.view")
      ? ctx.db.purchaseOrder.findMany({
          where: { poNumber: like },
          take,
          select: { id: true, poNumber: true, supplierName: true },
        })
      : none,
    ctx.can("sales.view")
      ? ctx.db.salesOrder.findMany({
          where: { orderNumber: like },
          take,
          select: { id: true, orderNumber: true, customerName: true },
        })
      : none,
  ]);

  return {
    products: products.map((p) => ({
      id: p.id,
      title: p.name,
      sub: p.sku,
      href: `/products?q=${encodeURIComponent(p.sku)}`,
    })),
    tiles: tiles.map((t) => ({ id: t.id, title: t.code, sub: t.type, href: `/locations/map#${t.code}` })),
    batches: batches.map((b) => ({ id: b.id, title: b.batchNo, sub: b.product.name, href: `/stock` })),
    orders: [
      ...pos.map((o) => ({ id: o.id, title: o.poNumber, sub: o.supplierName, href: "/purchase-orders" })),
      ...sos.map((o) => ({ id: o.id, title: o.orderNumber, sub: o.customerName, href: "/sales-orders" })),
    ],
  };
}

/** Exact lookup for the scanner: barcode / SKU, tile code, or batch number. */
export async function lookupCode(ctx: Context, raw: string) {
  const code = raw.trim().slice(0, 64);
  if (!code) return null;
  const upper = code.toUpperCase();
  const product = await ctx.db.product.findFirst({
    where: { OR: [{ barcode: code }, { sku: upper }] },
    select: { id: true, sku: true, name: true },
  });
  if (product) {
    const qty = (await stockByProduct(ctx.db)).get(product.id) ?? 0;
    return { kind: "product" as const, title: product.name, sub: product.sku, qty, href: "/products" };
  }
  const tile = await ctx.db.location.findFirst({
    where: { code: upper },
    select: { id: true, code: true, type: true },
  });
  if (tile) {
    const agg = await ctx.db.stockBalance.aggregate({ where: { locationId: tile.id }, _sum: { quantity: true } });
    return {
      kind: "tile" as const,
      title: tile.code,
      sub: tile.type,
      qty: agg._sum.quantity ?? 0,
      href: "/locations/map",
    };
  }
  const batch = await ctx.db.batch.findFirst({
    where: { batchNo: code },
    select: { id: true, batchNo: true, product: { select: { name: true } } },
  });
  if (batch) {
    const agg = await ctx.db.stockBalance.aggregate({ where: { batchId: batch.id }, _sum: { quantity: true } });
    return {
      kind: "batch" as const,
      title: batch.batchNo,
      sub: batch.product.name,
      qty: agg._sum.quantity ?? 0,
      href: "/stock",
    };
  }
  return null;
}
