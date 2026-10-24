import { describe, expect, it } from "vitest";
import { nextRow, roomRows, summarizeRooms } from "@/lib/rooms";

const tile = (zone: string, row: number, column: number, boxes: number, capacity: number | null = 10, level = 1) => ({
  zone,
  row,
  column,
  level,
  boxes,
  capacity,
});

describe("rooms", () => {
  it("summarizes each room's tiles, boxes and fill", () => {
    const [r1] = summarizeRooms(
      [{ id: "r1", zone: "BT1", name: "Room 1", note: "Near the gate" }],
      [tile("BT1", 1, 1, 0), tile("BT1", 1, 2, 5), tile("BT1", 2, 1, 9), tile("BT2", 1, 1, 3)],
    );
    expect(r1).toMatchObject({ zone: "BT1", name: "Room 1", tiles: 3, used: 2, full: 1, boxes: 14, capacity: 30 });
    expect(r1.fill).toBeCloseTo(14 / 30);
  });

  it("lists zones without a room, and empty rooms, in natural order", () => {
    const list = summarizeRooms(
      [
        { id: "r10", zone: "BT10", name: "Store", note: null },
        { id: "r2", zone: "BT2", name: "Room 2", note: null },
      ],
      [tile("BT1", 1, 1, 0)],
    );
    expect(list.map((r) => [r.zone, r.name, r.id, r.tiles])).toEqual([
      ["BT1", "BT1", null, 1],
      ["BT2", "Room 2", "r2", 0],
      ["BT10", "Store", "r10", 0],
    ]);
    expect(list[1].fill).toBeNull();
    expect(list[1].capacity).toBeNull();
  });

  it("does not count boxes on tiles without capacity towards the fill", () => {
    const [r] = summarizeRooms([], [tile("BT1", 1, 1, 50, null), tile("BT1", 1, 2, 5, 10)]);
    expect(r).toMatchObject({ boxes: 55, capacity: 10, full: 0 });
    expect(r.fill).toBeCloseTo(0.5);
  });

  it("groups tiles by row letter, sorted by column then level", () => {
    const rows = roomRows([
      tile("BT1", 2, 2, 0),
      tile("BT1", 1, 3, 0),
      tile("BT1", 1, 1, 0, 10, 2),
      tile("BT1", 1, 1, 0),
    ]);
    expect(rows.map((r) => [r.row, r.tiles.map((t) => `${t.column}.${t.level}`)])).toEqual([
      ["A", ["1.1", "1.2", "3.1"]],
      ["B", ["2.1"]],
    ]);
  });

  it("suggests the next free row letter", () => {
    expect(nextRow([])).toBe("A");
    expect(nextRow([{ row: 1 }, { row: 3 }])).toBe("D");
    expect(nextRow([{ row: 26 }])).toBe("AA");
  });
});
