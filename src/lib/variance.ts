export type CountLine = {
  id: string;
  systemQuantity: number;
  countedQuantity: number | null;
  varianceReason?: string | null;
};

/** Variance = counted - system. Every non-zero variance needs a reason before approval. */
export function computeVariance(lines: CountLine[]) {
  const rows = lines.map((l) => {
    const variance = l.countedQuantity == null ? null : l.countedQuantity - l.systemQuantity;
    return { ...l, variance, needsReason: !!variance && !l.varianceReason?.trim() };
  });
  return {
    rows,
    uncounted: rows.filter((r) => r.variance == null).length,
    missingReasons: rows.filter((r) => r.needsReason).length,
    gain: rows.reduce((s, r) => s + Math.max(0, r.variance ?? 0), 0),
    loss: rows.reduce((s, r) => s + Math.max(0, -(r.variance ?? 0)), 0),
    ready: rows.every((r) => r.variance != null && !r.needsReason),
  };
}
