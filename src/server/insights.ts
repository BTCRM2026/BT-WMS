import type { TenantDb } from "@/server/db/tenant";

/**
 * Read-only figures for the dashboard, alerts and lists. Every number comes
 * from stock_balance / stock_movements through the tenant-scoped client.
 */

const DAY = 86_400_000;

export async function stockByProduct(db: TenantDb) {
  const rows = await db.stockBalance.groupBy({ by: ["productId"], _sum: { quantity: true } });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

export async function stockByBatch(db: TenantDb) {
  const rows = await db.stockBalance.groupBy({
    by: ["batchId"],
    _sum: { quantity: true },
    where: { batchId: { not: null } },
  });
  return new Map(rows.map((r) => [r.batchId!, r._sum.quantity ?? 0]));
}

export async function lowStock(db: TenantDb) {
  const [products, stock] = await Promise.all([
    db.product.findMany({ where: { isActive: true }, select: { id: true, sku: true, name: true, minStock: true } }),
    stockByProduct(db),
  ]);
  return products
    .map((p) => ({ ...p, qty: stock.get(p.id) ?? 0 }))
    .filter((p) => p.qty < p.minStock)
    .sort((a, b) => a.qty - b.qty);
}

/** Batches with stock on hand that expire within `days` (or already expired). */
export async function expiringBatches(db: TenantDb, days = 90) {
  const onHand = await stockByBatch(db);
  const batches = await db.batch.findMany({
    where: { id: { in: [...onHand.keys()] }, expiryDate: { lte: new Date(Date.now() + days * DAY) } },
    select: { id: true, batchNo: true, expiryDate: true, product: { select: { id: true, name: true, sku: true } } },
    orderBy: { expiryDate: "asc" },
  });
  return batches.map((b) => ({ ...b, qty: onHand.get(b.id) ?? 0, expired: b.expiryDate! < new Date() }));
}

export async function alerts(db: TenantDb) {
  const [low, exp] = await Promise.all([lowStock(db), expiringBatches(db, 90)]);
  return [
    ...exp
      .filter((b) => b.expired)
      .map((b) => ({
        kind: "expired" as const,
        id: b.id,
        name: b.product.name,
        batch: b.batchNo,
        date: b.expiryDate!.toISOString(),
      })),
    ...low.map((p) => ({ kind: "low" as const, id: p.id, name: p.name, qty: p.qty, min: p.minStock })),
    ...exp
      .filter((b) => !b.expired)
      .map((b) => ({
        kind: "expiring" as const,
        id: b.id,
        name: b.product.name,
        batch: b.batchNo,
        date: b.expiryDate!.toISOString(),
      })),
  ];
}
export type Alert = Awaited<ReturnType<typeof alerts>>[number];

export async function dashboardData(db: TenantDb) {
  const since = new Date(Date.now() - 29 * DAY);
  since.setHours(0, 0, 0, 0);

  const [skus, balances, movements, locations, alertList, batches] = await Promise.all([
    db.product.count({ where: { isActive: true } }),
    db.stockBalance.findMany({ select: { locationId: true, batchId: true, quantity: true } }),
    // ponytail: daily totals summed in JS; switch to a SQL date_trunc groupBy if movements per month exceed ~100k.
    db.stockMovement.findMany({
      where: { createdAt: { gte: since }, type: { in: ["INWARD", "OUTWARD"] }, reversalOfId: null },
      select: { createdAt: true, type: true, quantity: true },
    }),
    db.location.findMany({ select: { id: true, zone: true, type: true } }),
    alerts(db),
    db.batch.findMany({ where: { expiryDate: { not: null } }, select: { id: true, expiryDate: true } }),
  ]);

  const units = balances.reduce((s, b) => s + b.quantity, 0);

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(since.getTime() + i * DAY);
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      inward: 0,
      outward: 0,
    };
  });
  const byDay = new Map(days.map((d) => [d.key, d]));
  for (const m of movements) {
    const d = byDay.get(new Date(m.createdAt).toISOString().slice(0, 10));
    if (d) d[m.type === "INWARD" ? "inward" : "outward"] += m.quantity;
  }

  const locById = new Map(locations.map((l) => [l.id, l]));
  const zones = new Map<string, number>();
  const usedTiles = new Set<string>();
  for (const b of balances) {
    const l = locById.get(b.locationId);
    if (!l || l.type !== "STORAGE") continue;
    usedTiles.add(l.id);
    zones.set(l.zone, (zones.get(l.zone) ?? 0) + b.quantity);
  }

  const expiryById = new Map(batches.map((b) => [b.id, b.expiryDate!]));
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + i);
    return {
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      units: 0,
    };
  });
  const byMonth = new Map(months.map((m) => [m.key, m]));
  for (const b of balances) {
    const exp = b.batchId ? expiryById.get(b.batchId) : undefined;
    const m = exp && byMonth.get(exp.toISOString().slice(0, 7));
    if (m) m.units += b.quantity;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayMoves, pendingPutaway, pendingPicks] = await Promise.all([
    db.stockMovement.groupBy({
      by: ["type"],
      where: { createdAt: { gte: today }, type: { in: ["INWARD", "OUTWARD"] } },
      _sum: { quantity: true },
    }),
    db.inwardReceiptLine.count({ where: { putawayAt: null, quantity: { gt: 0 } } }),
    db.pickList.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  const todayQty = (type: string) => todayMoves.find((m) => m.type === type)?._sum.quantity ?? 0;

  return {
    kpis: {
      todayIn: todayQty("INWARD"),
      todayOut: todayQty("OUTWARD"),
      pendingPutaway,
      pendingPicks,
      skus,
      units,
      lowStock: alertList.filter((a) => a.kind === "low").length,
      nearExpiry: alertList.filter((a) => a.kind !== "low").length,
      tilesUsed: usedTiles.size,
      tilesTotal: locations.filter((l) => l.type === "STORAGE").length,
    },
    trend: days.map(({ label, inward, outward }) => ({ label, inward, outward })),
    zones: [...zones].sort().map(([zone, units]) => ({ zone, units })),
    expiry: months.map(({ label, units }) => ({ label, units })),
    alerts: alertList,
  };
}

/** Every tile with its current units and what is on it (for the table and the floor map). */
export async function tilesWithStock(db: TenantDb) {
  const [locations, balances] = await Promise.all([
    db.location.findMany({ orderBy: [{ zone: "asc" }, { row: "asc" }, { column: "asc" }] }),
    db.stockBalance.findMany({ select: { locationId: true, productId: true, batchId: true, quantity: true } }),
  ]);
  const [products, batches] = await Promise.all([
    db.product.findMany({
      where: { id: { in: [...new Set(balances.map((b) => b.productId))] } },
      select: { id: true, sku: true, name: true },
    }),
    db.batch.findMany({
      where: { id: { in: balances.flatMap((b) => (b.batchId ? [b.batchId] : [])) } },
      select: { id: true, batchNo: true, expiryDate: true },
    }),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const batchById = new Map(batches.map((b) => [b.id, b]));
  return locations.map((l) => {
    const lines = balances
      .filter((b) => b.locationId === l.id)
      .map((b) => ({
        sku: productById.get(b.productId)?.sku ?? "",
        product: productById.get(b.productId)?.name ?? "",
        batch: b.batchId ? (batchById.get(b.batchId)?.batchNo ?? null) : null,
        expiry: b.batchId ? (batchById.get(b.batchId)?.expiryDate?.toISOString() ?? null) : null,
        qty: b.quantity,
      }));
    const units = lines.reduce((s, x) => s + x.qty, 0);
    return {
      id: l.id,
      code: l.code,
      zone: l.zone,
      row: l.row,
      column: l.column,
      level: l.level,
      type: l.type,
      capacity: l.capacity,
      isActive: l.isActive,
      units,
      fill: l.capacity ? Math.min(1, units / l.capacity) : null,
      lines,
    };
  });
}
export type TileWithStock = Awaited<ReturnType<typeof tilesWithStock>>[number];

/** SUPER_ADMIN only: the same headline figures for every company side by side. */
export async function ownerSummary() {
  const { prisma } = await import("@/server/db/client");
  const { tenantDb } = await import("@/server/db/tenant");
  const { REPORTS } = await import("@/server/reports");
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  return Promise.all(
    companies.map(async (c) => {
      const db = tenantDb(c.id);
      const [d, val] = await Promise.all([
        dashboardData(db),
        REPORTS.valuation(db, { from: new Date(0), to: new Date() }),
      ]);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        brandColor: c.brandColor,
        ...d.kpis,
        value: val.totals?.value ?? 0,
        mrpValue: val.totals?.mrpValue ?? 0,
      };
    }),
  );
}
