import { zoneBelongsTo } from "./tile";

export type PutawayTile = {
  id: string;
  code: string;
  zone: string;
  row: number;
  column: number;
  level: number;
  type: string;
  isActive: boolean;
  capacity: number | null;
  /** Units currently on the tile (all products). */
  units: number;
};

const free = (t: PutawayTile) => (t.capacity == null ? Infinity : t.capacity - t.units);

/** A tile that may receive this company's stock at all. */
export const canStoreOn = (t: PutawayTile, companyCode: string) =>
  t.type === "STORAGE" && t.isActive && zoneBelongsTo(t.zone, companyCode);

/**
 * Where should these units go?
 * 1. The product's default tile, if it is a usable tile of this company with room.
 * 2. Otherwise the nearest usable tile with room: same zone first, then fewest
 *    rows + columns away from the default tile (or from A-01 if there is none),
 *    then the lowest level, then the code.
 */
export function suggestPutaway(opts: {
  tiles: PutawayTile[];
  companyCode: string;
  quantity: number;
  defaultLocationId?: string | null;
}): PutawayTile | null {
  const { tiles, companyCode, quantity, defaultLocationId } = opts;
  const candidates = tiles.filter((t) => canStoreOn(t, companyCode) && free(t) >= quantity);
  const home = tiles.find((t) => t.id === defaultLocationId);
  if (home && candidates.includes(home)) return home;

  const ref = home ?? { zone: candidates[0]?.zone ?? "", row: 1, column: 1 };
  const dist = (t: PutawayTile) =>
    (t.zone === ref.zone ? 0 : 10_000) + Math.abs(t.row - ref.row) + Math.abs(t.column - ref.column);
  return (
    [...candidates].sort((a, b) => dist(a) - dist(b) || a.level - b.level || a.code.localeCompare(b.code))[0] ?? null
  );
}
