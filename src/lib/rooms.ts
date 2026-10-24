import { rowLetter } from "./tile";

/** A room is a zone with a name. Its tiles are the locations in that zone. */
export type RoomInfo = { id: string | null; zone: string; name: string; note: string | null };
type TileLike = { zone: string; row: number; column: number; level: number; boxes: number; capacity: number | null };

export type RoomSummary = RoomInfo & {
  tiles: number;
  /** Tiles with at least one box. */
  used: number;
  /** Tiles at 90% of capacity or more. */
  full: number;
  boxes: number;
  /** Sum of tile capacities; null when no tile has one. */
  capacity: number | null;
  fill: number | null;
};

const byZone = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/** One summary per room, plus one per zone that has tiles but no room yet (named after the zone). */
export function summarizeRooms(rooms: RoomInfo[], tiles: TileLike[]): RoomSummary[] {
  const all = new Map(rooms.map((r) => [r.zone, r]));
  for (const t of tiles) if (!all.has(t.zone)) all.set(t.zone, { id: null, zone: t.zone, name: t.zone, note: null });
  return [...all.values()]
    .sort((a, b) => byZone(a.zone, b.zone))
    .map((r) => {
      const zt = tiles.filter((t) => t.zone === r.zone);
      const withCap = zt.filter((t) => t.capacity != null);
      const capacity = withCap.length ? withCap.reduce((s, t) => s + t.capacity!, 0) : null;
      const boxesOnCapped = withCap.reduce((s, t) => s + t.boxes, 0);
      return {
        ...r,
        tiles: zt.length,
        used: zt.filter((t) => t.boxes > 0).length,
        full: zt.filter((t) => t.capacity != null && t.boxes >= t.capacity * 0.9).length,
        boxes: zt.reduce((s, t) => s + t.boxes, 0),
        capacity,
        fill: capacity ? Math.min(1, boxesOnCapped / capacity) : null,
      };
    });
}

/** Tiles of one room grouped by row (A, B, C ...), each row sorted by column then level. */
export function roomRows<T extends TileLike>(tiles: T[]): { row: string; tiles: T[] }[] {
  const rows = [...new Set(tiles.map((t) => t.row))].sort((a, b) => a - b);
  return rows.map((n) => ({
    row: rowLetter(n),
    tiles: tiles.filter((t) => t.row === n).sort((a, b) => a.column - b.column || a.level - b.level),
  }));
}

/** The row letter after the last one used in the room: A for an empty room. */
export const nextRow = (tiles: { row: number }[]) => rowLetter(Math.max(0, ...tiles.map((t) => t.row)) + 1);
