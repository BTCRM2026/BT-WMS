"use server";

import { action } from "@/server/action";
import { createPurchaseOrder } from "@/server/ops/inward";

export const createPoAction = action("purchase.manage", (ctx, input: Parameters<typeof createPurchaseOrder>[1]) =>
  createPurchaseOrder(ctx, input),
);
