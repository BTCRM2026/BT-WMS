import { apiRoute } from "@/server/auth/context";

export const GET = apiRoute("products.view", async ({ db }, req) => {
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1);
  const take = 50;
  const [items, total] = await Promise.all([
    db.product.findMany({ orderBy: { sku: "asc" }, skip: (page - 1) * take, take }),
    db.product.count(),
  ]);
  return { items, total, page, pageSize: take };
});
