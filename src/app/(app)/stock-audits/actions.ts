"use server";

import { action } from "@/server/action";
import { approveCount, createCount, enterCounts } from "@/server/ops/internal";

export const createCountAction = action("audit.manage", async (ctx, input: Parameters<typeof createCount>[1]) =>
  createCount(ctx, input),
);
export const enterCountsAction = action("audit.manage", async (ctx, input: Parameters<typeof enterCounts>[1]) =>
  enterCounts(ctx, input),
);
/** Approval needs stock.approve: WAREHOUSE_MANAGER, ADMIN, SUPER_ADMIN. */
export const approveCountAction = action("stock.approve", async (ctx, input: Parameters<typeof approveCount>[1]) =>
  approveCount(ctx, input),
);
