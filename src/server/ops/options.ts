import type { Context } from "@/server/auth/context";

/** Active products for pickers (id, sku, name). */
export const productOptions = (ctx: Context) =>
  ctx.db.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, name: true, expiryTracked: true },
    orderBy: { sku: "asc" },
  });
