/** A quantity of one product sitting on one tile, in one batch. */
export type Lot = {
  batchId: string | null;
  batchNo?: string | null;
  expiryDate: Date | null;
  locationId: string;
  locationCode: string;
  available: number;
};

export type Allocation = Lot & { quantity: number };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Expired = expiry date before today. Stock expiring today can still be picked. */
export const isExpired = (lot: Pick<Lot, "expiryDate">, today = new Date()) =>
  !!lot.expiryDate && lot.expiryDate < startOfDay(today);

/**
 * FEFO: take from the earliest-expiring batch first, never from expired stock.
 * Batches without an expiry go last. Ties break by tile code so pickers walk a
 * predictable route. Returns what could be allocated and how much is short.
 */
export function allocateFefo(lots: Lot[], quantity: number, today = new Date()) {
  const usable = lots
    .filter((l) => l.available > 0 && !isExpired(l, today))
    .sort(
      (a, b) =>
        (a.expiryDate?.getTime() ?? Infinity) - (b.expiryDate?.getTime() ?? Infinity) ||
        a.locationCode.localeCompare(b.locationCode),
    );
  const allocations: Allocation[] = [];
  let remaining = quantity;
  for (const lot of usable) {
    if (remaining <= 0) break;
    const take = Math.min(lot.available, remaining);
    allocations.push({ ...lot, quantity: take });
    remaining -= take;
  }
  return { allocations, short: Math.max(0, remaining) };
}
