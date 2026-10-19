import { describe, expect, it } from "vitest";
import { computeVariance } from "@/lib/variance";

describe("cycle count variance", () => {
  it("computes counted minus system and totals gains and losses", () => {
    const r = computeVariance([
      { id: "a", systemQuantity: 10, countedQuantity: 8, varianceReason: "Broken" },
      { id: "b", systemQuantity: 5, countedQuantity: 7, varianceReason: "Found" },
      { id: "c", systemQuantity: 3, countedQuantity: 3 },
    ]);
    expect(r.rows.map((x) => x.variance)).toEqual([-2, 2, 0]);
    expect([r.gain, r.loss]).toEqual([2, 2]);
    expect(r.ready).toBe(true);
  });

  it("requires a reason for every non-zero variance", () => {
    const r = computeVariance([
      { id: "a", systemQuantity: 10, countedQuantity: 9, varianceReason: "  " },
      { id: "b", systemQuantity: 4, countedQuantity: 4 },
    ]);
    expect(r.missingReasons).toBe(1);
    expect(r.ready).toBe(false);
  });

  it("is not ready while lines are uncounted", () => {
    const r = computeVariance([{ id: "a", systemQuantity: 1, countedQuantity: null }]);
    expect(r.uncounted).toBe(1);
    expect(r.ready).toBe(false);
  });
});
