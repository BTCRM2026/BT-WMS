"use server";

import { action } from "@/server/action";
import { confirmPick } from "@/server/ops/outward";

export const confirmPickAction = action("picking.manage", (ctx, input: Parameters<typeof confirmPick>[1]) =>
  confirmPick(ctx, input),
);
