"use server";

import { action } from "@/server/action";
import { inspectReturn, receiveReturn } from "@/server/ops/internal";

export const receiveReturnAction = action("returns.manage", async (ctx, input: Parameters<typeof receiveReturn>[1]) =>
  receiveReturn(ctx, input),
);
export const inspectReturnAction = action("returns.manage", async (ctx, input: Parameters<typeof inspectReturn>[1]) =>
  inspectReturn(ctx, input),
);
