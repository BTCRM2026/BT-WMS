"use server";

import { action } from "@/server/action";
import { HttpError } from "@/server/auth/context";
import { importProducts, MAX_IMPORT_BYTES, saveProduct, setProductActive } from "@/server/ops/masters";

export const saveProductAction = action("products.manage", (ctx, input: Parameters<typeof saveProduct>[1]) =>
  saveProduct(ctx, input),
);
export const setProductActiveAction = action("products.manage", (ctx, input: { id: string; isActive: boolean }) =>
  setProductActive(ctx, input.id, input.isActive),
);
export const importProductsAction = action("products.manage", async (ctx, form: FormData) => {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Choose a .csv or .xlsx file.");
  if (file.size > MAX_IMPORT_BYTES) throw new HttpError(413, "File is larger than 2 MB.");
  return importProducts(
    ctx,
    { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
    form.get("commit") === "1",
  );
});
