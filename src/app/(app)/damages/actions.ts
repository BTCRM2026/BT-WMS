"use server";

import { action } from "@/server/action";
import { decideWriteOff, reportWriteOff } from "@/server/ops/internal";

export const reportWriteOffAction = action("returns.manage", (ctx, input: Parameters<typeof reportWriteOff>[1]) =>
  reportWriteOff(ctx, input),
);
/** Approval needs stock.approve: WAREHOUSE_MANAGER, ADMIN, SUPER_ADMIN. */
export const decideWriteOffAction = action("stock.approve", (ctx, input: Parameters<typeof decideWriteOff>[1]) =>
  decideWriteOff(ctx, input),
);
