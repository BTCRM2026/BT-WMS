"use server";

import { action } from "@/server/action";
import { transferStock } from "@/server/ops/internal";

export const transferAction = action("stock.move", async (ctx, input: Parameters<typeof transferStock>[1]) =>
  transferStock(ctx, input),
);
