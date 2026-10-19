"use server";

import { action } from "@/server/action";
import {
  cancelDispatch,
  cancelSalesOrder,
  createSalesOrder,
  dispatchOrder,
  generatePickList,
  packOrder,
} from "@/server/ops/outward";

export const createSoAction = action("sales.manage", async (ctx, input: Parameters<typeof createSalesOrder>[1]) =>
  createSalesOrder(ctx, input),
);
export const cancelSoAction = action("sales.manage", async (ctx, input: Parameters<typeof cancelSalesOrder>[1]) =>
  cancelSalesOrder(ctx, input),
);
export const generatePickAction = action("picking.manage", async (ctx, input: Parameters<typeof generatePickList>[1]) =>
  generatePickList(ctx, input),
);
export const packAction = action("picking.manage", async (ctx, input: Parameters<typeof packOrder>[1]) =>
  packOrder(ctx, input),
);
export const dispatchAction = action("dispatch.manage", async (ctx, input: Parameters<typeof dispatchOrder>[1]) =>
  dispatchOrder(ctx, input),
);
export const cancelDispatchAction = action(
  "dispatch.manage",
  async (ctx, input: Parameters<typeof cancelDispatch>[1]) => cancelDispatch(ctx, input),
);
