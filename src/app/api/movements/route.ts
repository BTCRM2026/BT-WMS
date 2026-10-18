import { apiRoute } from "@/server/auth/context";

export const GET = apiRoute("stock.view", async ({ db }, req) => {
  const p = new URL(req.url).searchParams;
  return {
    items: await db.stockMovement.findMany({
      where: { productId: p.get("productId") ?? undefined, locationId: p.get("locationId") ?? undefined },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  };
});
