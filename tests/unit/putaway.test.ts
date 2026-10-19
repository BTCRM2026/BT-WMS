import { describe, expect, it } from "vitest";
import { suggestPutaway, type PutawayTile } from "@/lib/putaway";

const tile = (code: string, units = 0, extra: Partial<PutawayTile> = {}): PutawayTile => {
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
    units,
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
