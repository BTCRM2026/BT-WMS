import { apiRoute, HttpError } from "@/server/auth/context";

export const GET = apiRoute<{ id: string }>("products.view", async ({ db }, _req, { id }) => {
  const product = await db.product.findUnique({ where: { id }, include: { batches: true } });
  if (!product) throw new HttpError(404, "Not found");
  return product;
});
