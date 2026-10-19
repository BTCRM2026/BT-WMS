"use server";

import { action } from "@/server/action";
import { saveUser } from "@/server/ops/masters";

export const saveUserAction = action("users.manage", (ctx, input: Parameters<typeof saveUser>[1]) =>
  saveUser(ctx, input),
);
