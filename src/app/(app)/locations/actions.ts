"use server";

import { action } from "@/server/action";
import { generateTiles, saveTile, setTileActive } from "@/server/ops/masters";

export const saveTileAction = action("locations.manage", async (ctx, input: Parameters<typeof saveTile>[1]) =>
  saveTile(ctx, input),
);
export const generateTilesAction = action("locations.manage", async (ctx, input: Parameters<typeof generateTiles>[1]) =>
  generateTiles(ctx, input),
);
export const setTileActiveAction = action("locations.manage", async (ctx, input: { id: string; isActive: boolean }) =>
  setTileActive(ctx, input.id, input.isActive),
);
