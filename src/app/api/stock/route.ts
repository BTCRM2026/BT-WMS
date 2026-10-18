import { apiRoute } from "@/server/auth/context";

// Stock is always read from the stock_balance view (derived from stock_movements).
export const GET = apiRoute("stock.view", async ({ db }, req) => {
  const productId = new URL(req.url).searchParams.get("productId") ?? undefined;
  return { items: await db.stockBalance.findMany({ where: { productId }, take: 500 }) };
});
