"use server";

import { action } from "@/server/action";
import { confirmPutaway, receiveGoods, suggestFor } from "@/server/ops/inward";

export const receiveAction = action("inward.manage", (ctx, input: Parameters<typeof receiveGoods>[1]) =>
  receiveGoods(ctx, input),
);
export const putawayAction = action("inward.manage", (ctx, input: Parameters<typeof confirmPutaway>[1]) =>
  confirmPutaway(ctx, input),
);
export const suggestAction = action("inward.view", (ctx, lineId: string) => suggestFor(ctx, lineId));
