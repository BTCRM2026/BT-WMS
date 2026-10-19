import { describe, expect, it } from "vitest";
import { allocateFefo, isExpired, type Lot } from "@/lib/fefo";

const today = new Date(2026, 9, 19); // 19 Oct 2026
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const lot = (batchId: string, expiry: Date | null, available: number, locationCode = "BT-A-01-1"): Lot => ({
  batchId,
  expiryDate: expiry,
  locationId: locationCode,
  locationCode,
  available,
});

describe("FEFO allocation", () => {
  it("takes the earliest expiry first", () => {
    const r = allocateFefo([lot("late", d(2027, 6, 1), 50), lot("early", d(2026, 12, 1), 30)], 40, today);
    expect(r.allocations.map((a) => [a.batchId, a.quantity])).toEqual([
      ["early", 30],
      ["late", 10],
    ]);
    expect(r.short).toBe(0);
  });

  it("never picks expired stock", () => {
    const r = allocateFefo([lot("expired", d(2026, 10, 18), 100), lot("ok", d(2027, 1, 1), 5)], 20, today);
    expect(r.allocations.map((a) => a.batchId)).toEqual(["ok"]);
    expect(r.short).toBe(15);
  });

  it("stock expiring today is still allowed", () => {
    expect(isExpired({ expiryDate: d(2026, 10, 19) }, today)).toBe(false);
    expect(isExpired({ expiryDate: d(2026, 10, 18) }, today)).toBe(true);
    expect(isExpired({ expiryDate: null }, today)).toBe(false);
  });

  it("batches without expiry go last", () => {
    const r = allocateFefo([lot("none", null, 10), lot("dated", d(2028, 1, 1), 10)], 15, today);
    expect(r.allocations.map((a) => a.batchId)).toEqual(["dated", "none"]);
  });

  it("splits one batch across tiles in tile-code order", () => {
    const r = allocateFefo(
      [lot("b", d(2027, 1, 1), 5, "BT-B-01-1"), lot("b", d(2027, 1, 1), 5, "BT-A-02-1")],
      7,
      today,
    );
    expect(r.allocations.map((a) => [a.locationCode, a.quantity])).toEqual([
      ["BT-A-02-1", 5],
      ["BT-B-01-1", 2],
    ]);
  });

  it("reports the shortage when there is not enough", () => {
    const r = allocateFefo([lot("a", d(2027, 1, 1), 3)], 10, today);
    expect(r.short).toBe(7);
    expect(allocateFefo([], 4, today)).toEqual({ allocations: [], short: 4 });
  });

  it("ignores empty lots and never over-allocates", () => {
    const r = allocateFefo([lot("zero", d(2026, 11, 1), 0), lot("a", d(2027, 1, 1), 100)], 10, today);
    expect(r.allocations).toHaveLength(1);
    expect(r.allocations[0].quantity).toBe(10);
  });
});
