import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatTileCode, isTileForCompany, parseTileCode, TILE_CODE_RE } from "@/lib/tile";

describe("tile code validator", () => {
  it("parses the documented example", () => {
    expect(parseTileCode("BT-A-03-1")).toEqual({ company: "BT", zone: "A", row: 3, column: 1 });
  });

  it("normalises case and whitespace", () => {
    expect(parseTileCode("  rf-b-12-10 ")).toEqual({ company: "RF", zone: "B", row: 12, column: 10 });
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
    const p = { company: "RF", zone: "RT", row: 7, column: 4 };
    expect(formatTileCode(p)).toBe("RF-RT-07-4");
    expect(parseTileCode(formatTileCode(p))).toEqual(p);
  });

  it("checks the tile belongs to the company", () => {
    expect(isTileForCompany("BT-A-03-1", "BT")).toBe(true);
    expect(isTileForCompany("RF-A-03-1", "BT")).toBe(false);
    expect(isTileForCompany("garbage", "BT")).toBe(false);
  });

  it("matches the database CHECK constraint pattern", () => {
    const sql = readFileSync("prisma/migrations/20261018191300_integrity/migration.sql", "utf8");
    const dbPattern = /"code" ~ '([^']+)'/.exec(sql)![1];
    expect(dbPattern).toBe("^[A-Z0-9]{2,4}-[A-Z]{1,2}-[0-9]{2}-[0-9]{1,2}$");
    expect(TILE_CODE_RE.source).toBe("^([A-Z0-9]{2,4})-([A-Z]{1,2})-(\\d{2})-(\\d{1,2})$");
  });
});
