"use server";

import { action } from "@/server/action";
import { attachReceiptPhotos, confirmPutaway, receiveGoods, suggestFor } from "@/server/ops/inward";

export const receiveAction = action("inward.manage", async (ctx, input: Parameters<typeof receiveGoods>[1]) =>
  receiveGoods(ctx, input),
);
export const putawayAction = action("inward.manage", async (ctx, input: Parameters<typeof confirmPutaway>[1]) =>
  confirmPutaway(ctx, input),
);
export const suggestAction = action("inward.view", async (ctx, lineId: string) => suggestFor(ctx, lineId));
export const uploadPhotosAction = action("inward.manage", async (ctx, form: FormData) => {
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  return attachReceiptPhotos(
    ctx,
    String(form.get("receiptId")),
    await Promise.all(
      files.map(async (f) => ({ name: f.name, type: f.type, bytes: Buffer.from(await f.arrayBuffer()) })),
    ),
  );
});
