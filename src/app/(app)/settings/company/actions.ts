"use server";

import { action } from "@/server/action";
import { saveSettings } from "@/server/ops/settings";

export const saveSettingsAction = action("users.manage", async (ctx, input: Parameters<typeof saveSettings>[1]) =>
  saveSettings(ctx, input),
);
