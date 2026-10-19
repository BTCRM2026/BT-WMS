import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  expandRows,
  formatTileCode,
  isTileForCompany,
  parseTileCode,
  rowLetter,
  rowNumber,
  TILE_CODE_RE,
} from "@/lib/tile";

describe("tile code validator", () => {
  it("parses the documented example: zone BT, row A, column 03, level 1", () => {
    expect(parseTileCode("BT-A-03-1")).toEqual({ zone: "BT", row: "A", column: 3, level: 1 });
  });

  it("normalises case and whitespace", () => {
    expect(parseTileCode("  rf2-b-12-10 ")).toEqual({ zone: "RF2", row: "B", column: 12, level: 10 });
  });

  it.each([
    "",
    "BT",
    "BT-A-3-1",
    "BT-A-003-1",
    "BT-1-03-1",
    "BT-ABC-03-1",
    "BT-A-03-100",
    "BT_A_03_1",
    "B-A-03-1",
    "BT-A-03-1; DROP TABLE",
  ])("rejects %j", (code) => expect(parseTileCode(code)).toBeNull());

  it("round-trips format -> parse", () => {
    const p = { zone: "RFX", row: "RT", column: 7, level: 2 };
    expect(formatTileCode(p)).toBe("RFX-RT-07-2");
    expect(parseTileCode(formatTileCode(p))).toEqual(p);
  });

  it("checks the tile is in one of the company's zones", () => {
    expect(isTileForCompany("BT-A-03-1", "BT")).toBe(true);
    expect(isTileForCompany("BTX-R-01-1", "BT")).toBe(true);
    expect(isTileForCompany("RF-A-03-1", "BT")).toBe(false);
    expect(isTileForCompany("garbage", "BT")).toBe(false);
  });

  it("converts row letters to numbers and back", () => {
    expect([rowNumber("A"), rowNumber("F"), rowNumber("Z"), rowNumber("AA")]).toEqual([1, 6, 26, 27]);
    expect([rowLetter(1), rowLetter(26), rowLetter(27)]).toEqual(["A", "Z", "AA"]);
  });

  it("expands row ranges for bulk generation", () => {
    expect(expandRows("A-F")).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(expandRows("a, c-d")).toEqual(["A", "C", "D"]);
    expect(() => expandRows("1-3")).toThrow();
  });

  it("matches the database CHECK constraint pattern", () => {
    const sql = readFileSync("prisma/migrations/20261018191300_integrity/migration.sql", "utf8");
    const dbPattern = /"code" ~ '([^']+)'/.exec(sql)![1];
    expect(dbPattern).toBe("^[A-Z0-9]{2,4}-[A-Z]{1,2}-[0-9]{2}-[0-9]{1,2}$");
    expect(TILE_CODE_RE.source).toBe("^([A-Z0-9]{2,4})-([A-Z]{1,2})-(\\d{2})-(\\d{1,2})$");
  });
});
