import { describe, expect, it } from "vitest";
import { boxesOf, roomFor, splitPutaway, suggestPutaway, tileBook, type PutawayTile } from "@/lib/putaway";

const tile = (code: string, boxes = 0, extra: Partial<PutawayTile> = {}): PutawayTile => {
  const [zone, row, column, level] = code.split("-");
  return {
    id: code,
    code,
    zone,
    row: row.charCodeAt(0) - 64,
    column: Number(column),
    level: Number(level),
    type: "STORAGE",
    isActive: true,
    capacity: 100,
    boxes,
    ...extra,
  };
};

describe("putaway suggestion", () => {
  const tiles = [tile("BT-A-01-1", 90), tile("BT-A-02-1", 10), tile("BT-C-05-1"), tile("RF-A-01-1"), tile("BT-A-03-1")];

  it("uses the product's default tile when it has room", () => {
    expect(suggestPutaway({ tiles, companyCode: "BT", quantity: 10, defaultLocationId: "BT-A-01-1" })?.code).toBe(
      "BT-A-01-1",
    );
  });

  it("falls back to the nearest free tile when the default is full", () => {
    expect(suggestPutaway({ tiles, companyCode: "BT", quantity: 20, defaultLocationId: "BT-A-01-1" })?.code).toBe(
      "BT-A-02-1",
    );
    expect(suggestPutaway({ tiles, companyCode: "BT", quantity: 95, defaultLocationId: "BT-A-01-1" })?.code).toBe(
      "BT-A-03-1",
    );
  });

  it("never suggests another company's zone", () => {
    const onlyRf = [tile("BT-A-01-1", 100), tile("RF-A-01-1")];
    expect(
      suggestPutaway({ tiles: onlyRf, companyCode: "BT", quantity: 5, defaultLocationId: "BT-A-01-1" }),
    ).toBeNull();
    expect(suggestPutaway({ tiles, companyCode: "RF", quantity: 5 })?.code).toBe("RF-A-01-1");
  });

  it("skips inactive and non-storage tiles", () => {
    const t = [
      tile("BT-A-01-1", 0, { isActive: false }),
      tile("BTX-R-01-1", 0, { type: "RECEIVING" }),
      tile("BT-B-01-1"),
    ];
    expect(suggestPutaway({ tiles: t, companyCode: "BT", quantity: 5, defaultLocationId: "BT-A-01-1" })?.code).toBe(
      "BT-B-01-1",
    );
  });

  it("treats tiles without a capacity as unlimited", () => {
    const t = [tile("BT-A-01-1", 5000, { capacity: null })];
    expect(suggestPutaway({ tiles: t, companyCode: "BT", quantity: 999 })?.code).toBe("BT-A-01-1");
  });

  it("without a default tile, starts from row A column 1", () => {
    expect(
      suggestPutaway({ tiles: [tile("BT-D-09-1"), tile("BT-A-02-1")], companyCode: "BT", quantity: 1 })?.code,
    ).toBe("BT-A-02-1");
  });
});

describe("boxes", () => {
  it("converts units to boxes, a part box counts whole", () => {
    expect([boxesOf(0, 12), boxesOf(1, 12), boxesOf(12, 12), boxesOf(13, 12), boxesOf(5, 0)]).toEqual([0, 1, 1, 2, 5]);
  });

  it("room = min(tile capacity, product max boxes per tile) minus boxes on the tile", () => {
    const t = tile("BT-A-01-1", 4, { capacity: 10 });
    expect(roomFor(t, { packSize: 12 })).toBe(72); // 6 boxes free
    expect(roomFor(t, { packSize: 12, maxBoxesPerTile: 6 })).toBe(24); // 2 boxes free
    expect(roomFor(t, { packSize: 12, maxBoxesPerTile: 4 })).toBe(0);
    expect(roomFor(tile("BT-A-01-1", 12, { capacity: 10 }), { packSize: 12 })).toBe(0); // overfull, never negative
    expect(roomFor(tile("BT-A-01-1", 50, { capacity: null }), { packSize: 12 })).toBe(Infinity);
    expect(roomFor(tile("BT-A-01-1", 50, { capacity: null }), { packSize: 12, maxBoxesPerTile: 60 })).toBe(120);
  });

  it("tops up the product's own part box first", () => {
    // 5 units of this product = 1 box; capacity 2 boxes -> 24 units of this product in all.
    expect(roomFor(tile("BT-A-01-1", 1, { capacity: 2, productUnits: 5 }), { packSize: 12 })).toBe(19);
  });
});

describe("split putaway", () => {
  const tiles = [
    tile("BT-A-01-1", 1, { capacity: 3 }), // default tile, level 1 = 3 boxes
    tile("BT-A-01-2", 0, { capacity: 5 }), // level 2 = 5 boxes
    tile("BT-A-02-1", 0, { capacity: 3 }),
    tile("BT-B-05-1", 0, { capacity: 100 }),
    tile("RF-A-01-1", 0, { capacity: 100 }),
  ];
  const opts = { tiles, companyCode: "BT", defaultLocationId: "BT-A-01-1", product: { packSize: 10 } };
  const plan = (quantity: number, extra = {}) =>
    splitPutaway({ ...opts, quantity, ...extra }).map((p) => [p.tile.code, p.quantity]);

  it("fills the default tile, then the nearest tiles (same spot higher level, then next column)", () => {
    expect(plan(75)).toEqual([
      ["BT-A-01-1", 20],
      ["BT-A-01-2", 50],
      ["BT-A-02-1", 5],
    ]);
  });

  it("uses one tile when it fits", () => {
    expect(plan(15)).toEqual([["BT-A-01-1", 15]]);
  });

  it("respects the product's max boxes per tile", () => {
    expect(plan(75, { product: { packSize: 10, maxBoxesPerTile: 2 } })).toEqual([
      ["BT-A-01-1", 10], // min(3, 2) - 1 box = 1 box
      ["BT-A-01-2", 20],
      ["BT-A-02-1", 20],
      ["BT-B-05-1", 20],
    ]);
  });

  it("places what fits and leaves the rest when the zone is nearly full", () => {
    const small = [tile("BT-A-01-1", 2, { capacity: 3 }), tile("BT-A-02-1", 3, { capacity: 3 })];
    expect(splitPutaway({ ...opts, tiles: small, quantity: 40 }).map((p) => p.quantity)).toEqual([10]);
  });

  it("returns nothing when no tile has room", () => {
    const full = [tile("BT-A-01-1", 3, { capacity: 3 }), tile("RF-A-01-1")];
    expect(splitPutaway({ ...opts, tiles: full, quantity: 5 })).toEqual([]);
    expect(suggestPutaway({ ...opts, tiles: full, quantity: 5 })).toBeNull();
  });

  it("suggestPutaway still returns the first tile that takes everything", () => {
    expect(suggestPutaway({ ...opts, quantity: 45 })?.code).toBe("BT-A-01-2");
  });

  it("tileBook lets a second line see what the first one took", () => {
    const book = tileBook(tiles, [{ locationId: "BT-A-01-1", productId: "other", quantity: 7 }], (id) =>
      id === "other" ? 12 : 10,
    );
    expect(book.boxesOn("BT-A-01-1")).toBe(1);
    const first = splitPutaway({ ...opts, tiles: book.view("p1"), quantity: 20 });
    expect(first.map((p) => p.tile.code)).toEqual(["BT-A-01-1"]);
    for (const p of first) book.add(p.tile.id, "p1", p.quantity);
    const second = splitPutaway({ ...opts, tiles: book.view("p2"), quantity: 10 });
    expect(second.map((p) => p.tile.code)).toEqual(["BT-A-01-2"]);
  });
});
