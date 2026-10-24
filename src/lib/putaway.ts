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
  /** Boxes (cartons) that fit; null = not set (unlimited). */
  capacity: number | null;
  /** Boxes on the tile now (all products). */
  boxes: number;
  /** Units of the product being put away that are already on this tile. */
  productUnits?: number;
};

/** What we are putting away: units per box and the optional "max boxes per tile". */
export type PutawayProduct = { packSize: number; maxBoxesPerTile?: number | null };

/** Units -> boxes; a part box takes a whole slot. */
export const boxesOf = (units: number, packSize: number) => (units <= 0 ? 0 : Math.ceil(units / Math.max(1, packSize)));

/**
 * Units of this product the tile can still take.
 * Box limit = min(tile capacity, product max boxes per tile), minus the boxes already
 * on the tile; the product's own part box on the tile is topped up first.
 */
export function roomFor(t: PutawayTile, p: PutawayProduct): number {
  const limit = Math.min(t.capacity ?? Infinity, p.maxBoxesPerTile ?? Infinity);
  if (limit === Infinity) return Infinity;
  const pack = Math.max(1, p.packSize);
  const own = t.productUnits ?? 0;
  const others = t.boxes - boxesOf(own, pack);
  return Math.max(0, (limit - others) * pack - own);
}

/** A tile that may receive this company's stock at all. */
export const canStoreOn = (t: PutawayTile, companyCode: string) =>
  t.type === "STORAGE" && t.isActive && zoneBelongsTo(t.zone, companyCode);

type Opts = {
  tiles: PutawayTile[];
  companyCode: string;
  quantity: number;
  defaultLocationId?: string | null;
  /** Defaults to 1 unit per box. */
  product?: PutawayProduct;
};

/**
 * Usable tiles in the order we fill them: the product's default tile first, then
 * same zone first, fewest rows + columns away from the default tile (or from A-01
 * if there is none), lowest level, then the code.
 */
function inFillOrder({ tiles, companyCode, defaultLocationId }: Opts, hasRoom: (t: PutawayTile) => boolean) {
  const usable = tiles.filter((t) => canStoreOn(t, companyCode));
  const home = tiles.find((t) => t.id === defaultLocationId);
  const ref = home ?? { zone: usable.find(hasRoom)?.zone ?? "", row: 1, column: 1 };
  const dist = (t: PutawayTile) =>
    (t.zone === ref.zone ? 0 : 10_000) + Math.abs(t.row - ref.row) + Math.abs(t.column - ref.column);
  return usable.sort(
    (a, b) =>
      Number(b === home) - Number(a === home) || dist(a) - dist(b) || a.level - b.level || a.code.localeCompare(b.code),
  );
}

/** One tile that takes the whole quantity (default tile first, else nearest), or null. */
export function suggestPutaway(opts: Opts): PutawayTile | null {
  const p = opts.product ?? { packSize: 1 };
  const fits = (t: PutawayTile) => roomFor(t, p) >= opts.quantity;
  return inFillOrder(opts, fits).find(fits) ?? null;
}

/**
 * Split the quantity over as many tiles as needed, in fill order, by box room.
 * The parts add up to less than the quantity when the zones are full: the rest
 * stays on the receiving tile.
 */
export function splitPutaway(opts: Opts): { tile: PutawayTile; quantity: number }[] {
  const p = opts.product ?? { packSize: 1 };
  const out: { tile: PutawayTile; quantity: number }[] = [];
  let left = opts.quantity;
  for (const tile of inFillOrder(opts, (t) => roomFor(t, p) > 0)) {
    if (left <= 0) break;
    const take = Math.min(left, roomFor(tile, p));
    if (take > 0) out.push({ tile, quantity: take });
    left -= take;
  }
  return out;
}

/**
 * Units per (tile, product), so a plan for several receipt lines can account for
 * what earlier lines already took. `view(productId)` gives the tiles as that product sees them.
 */
export function tileBook<T extends Omit<PutawayTile, "boxes" | "productUnits">>(
  tiles: T[],
  stock: { locationId: string; productId: string; quantity: number }[],
  packOf: (productId: string) => number,
) {
  const units = new Map<string, Map<string, number>>();
  const add = (locationId: string, productId: string, quantity: number) => {
    const m = units.get(locationId) ?? new Map<string, number>();
    m.set(productId, (m.get(productId) ?? 0) + quantity);
    units.set(locationId, m);
  };
  for (const s of stock) add(s.locationId, s.productId, s.quantity);
  const boxesOn = (locationId: string) =>
    [...(units.get(locationId) ?? [])].reduce((s, [pid, q]) => s + boxesOf(q, packOf(pid)), 0);
  return {
    add,
    boxesOn,
    view: (productId: string): (T & PutawayTile)[] =>
      tiles.map((t) => ({ ...t, boxes: boxesOn(t.id), productUnits: units.get(t.id)?.get(productId) ?? 0 })),
  };
}
