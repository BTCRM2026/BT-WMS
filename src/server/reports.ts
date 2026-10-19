import type { Context } from "@/server/auth/context";
import type { TenantDb } from "@/server/db/tenant";

/**
 * Every report is plain data: columns + rows, so the same result renders as a
 * table, an Excel sheet or a PDF. All quantities come from stock_movements.
 */
export type ReportColumn = { key: string; header: string; kind?: "text" | "number" | "money" | "date" };
export type Report = {
  key: string;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number>;
};
export type Period = { from: Date; to: Date };

const DAY = 86_400_000;
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

async function lookups(db: TenantDb) {
  const [products, batches, tiles] = await Promise.all([
    db.product.findMany({
      select: { id: true, sku: true, name: true, purchasePrice: true, mrp: true, minStock: true },
    }),
    db.batch.findMany({ select: { id: true, batchNo: true, expiryDate: true } }),
    db.location.findMany({ select: { id: true, code: true, zone: true } }),
  ]);
  return {
    product: new Map(products.map((p) => [p.id, p])),
    batch: new Map(batches.map((b) => [b.id, b])),
    tile: new Map(tiles.map((t) => [t.id, t])),
    products,
  };
}

async function onHand(db: TenantDb) {
  return db.stockBalance.findMany({ where: { quantity: { gt: 0 } } });
}

type Builder = (db: TenantDb, p: Period) => Promise<Omit<Report, "key">>;

export const REPORTS: Record<string, Builder> = {
  async "stock-product"(db) {
    const [L, bal] = await Promise.all([lookups(db), onHand(db)]);
    const rows = L.products
      .map((p) => ({
        sku: p.sku,
        name: p.name,
        qty: sum(
          bal.filter((b) => b.productId === p.id),
          (b) => b.quantity,
        ),
        min: p.minStock,
      }))
      .filter((r) => r.qty > 0)
      .sort((a, b) => a.sku.localeCompare(b.sku));
    return {
      title: "Current stock by product",
      columns: [
        { key: "sku", header: "SKU" },
        { key: "name", header: "Product" },
        { key: "qty", header: "Qty", kind: "number" },
        { key: "min", header: "Min", kind: "number" },
      ],
      rows,
      totals: { qty: sum(rows, (r) => r.qty) },
    };
  },

  async "stock-batch"(db) {
    const [L, bal] = await Promise.all([lookups(db), onHand(db)]);
    const by = new Map<string, { sku: string; name: string; batch: string; expiry: string | null; qty: number }>();
    for (const b of bal) {
      const k = `${b.productId}|${b.batchId}`;
      const p = L.product.get(b.productId)!;
      const bt = b.batchId ? L.batch.get(b.batchId) : undefined;
      const row = by.get(k) ?? {
        sku: p.sku,
        name: p.name,
        batch: bt?.batchNo ?? "-",
        expiry: iso(bt?.expiryDate),
        qty: 0,
      };
      row.qty += b.quantity;
      by.set(k, row);
    }
    const rows = [...by.values()].sort((a, b) => a.sku.localeCompare(b.sku) || a.batch.localeCompare(b.batch));
    return {
      title: "Current stock by batch",
      columns: [
        { key: "sku", header: "SKU" },
        { key: "name", header: "Product" },
        { key: "batch", header: "Batch" },
        { key: "expiry", header: "Expiry", kind: "date" },
        { key: "qty", header: "Qty", kind: "number" },
      ],
      rows,
      totals: { qty: sum(rows, (r) => r.qty) },
    };
  },

  async "stock-tile"(db) {
    const [L, bal] = await Promise.all([lookups(db), onHand(db)]);
    const rows = bal
      .map((b) => ({
        tile: L.tile.get(b.locationId)?.code ?? "",
        sku: L.product.get(b.productId)?.sku ?? "",
        name: L.product.get(b.productId)?.name ?? "",
        batch: b.batchId ? (L.batch.get(b.batchId)?.batchNo ?? "-") : "-",
        qty: b.quantity,
      }))
      .sort((a, b) => a.tile.localeCompare(b.tile) || a.sku.localeCompare(b.sku));
    return {
      title: "Current stock by tile",
      columns: [
        { key: "tile", header: "Tile" },
        { key: "sku", header: "SKU" },
        { key: "name", header: "Product" },
        { key: "batch", header: "Batch" },
        { key: "qty", header: "Qty", kind: "number" },
      ],
      rows,
      totals: { qty: sum(rows, (r) => r.qty) },
    };
  },

  async valuation(db) {
    const [L, bal] = await Promise.all([lookups(db), onHand(db)]);
    const rows = L.products
      .map((p) => {
        const qty = sum(
          bal.filter((b) => b.productId === p.id),
          (b) => b.quantity,
        );
        return {
          sku: p.sku,
          name: p.name,
          qty,
          cost: Number(p.purchasePrice),
          value: round2(qty * Number(p.purchasePrice)),
          mrpValue: round2(qty * Number(p.mrp)),
        };
      })
      .filter((r) => r.qty > 0)
      .sort((a, b) => b.value - a.value);
    return {
      title: "Stock valuation (purchase price)",
      columns: [
        { key: "sku", header: "SKU" },
        { key: "name", header: "Product" },
        { key: "qty", header: "Qty", kind: "number" },
        { key: "cost", header: "Unit cost", kind: "money" },
        { key: "value", header: "Value", kind: "money" },
        { key: "mrpValue", header: "MRP value", kind: "money" },
      ],
      rows,
      totals: {
        qty: sum(rows, (r) => r.qty),
        value: round2(sum(rows, (r) => r.value)),
        mrpValue: round2(sum(rows, (r) => r.mrpValue)),
      },
    };
  },

  async ageing(db, p) {
    const [L, bal, firstIn] = await Promise.all([
      lookups(db),
      onHand(db),
      db.stockMovement.groupBy({ by: ["productId", "batchId"], where: { type: "INWARD" }, _min: { createdAt: true } }),
    ]);
    const since = new Map(firstIn.map((f) => [`${f.productId}|${f.batchId}`, f._min.createdAt!]));
    const bucket = (days: number) => (days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+");
    const by = new Map<
      string,
      { sku: string; name: string; batch: string; received: string | null; days: number; bucket: string; qty: number }
    >();
    for (const b of bal) {
      const k = `${b.productId}|${b.batchId}`;
      const first = since.get(k);
      const days = first ? Math.floor((p.to.getTime() - first.getTime()) / DAY) : 0;
      const row = by.get(k) ?? {
        sku: L.product.get(b.productId)!.sku,
        name: L.product.get(b.productId)!.name,
        batch: b.batchId ? (L.batch.get(b.batchId)?.batchNo ?? "-") : "-",
        received: iso(first),
        days,
        bucket: bucket(days),
        qty: 0,
      };
      row.qty += b.quantity;
      by.set(k, row);
    }
    const rows = [...by.values()].sort((a, b) => b.days - a.days);
    return {
      title: "Stock ageing (days since first receipt of the batch)",
      columns: [
        { key: "sku", header: "SKU" },
        { key: "name", header: "Product" },
        { key: "batch", header: "Batch" },
        { key: "received", header: "First received", kind: "date" },
        { key: "days", header: "Age (days)", kind: "number" },
        { key: "bucket", header: "Bucket" },
        { key: "qty", header: "Qty", kind: "number" },
      ],
      rows,
      totals: { qty: sum(rows, (r) => r.qty) },
    };
  },

  async "slow-dead"(db, p) {
    const [L, bal, out] = await Promise.all([
      lookups(db),
      onHand(db),
      db.stockMovement.groupBy({
        by: ["productId"],
        where: { type: "OUTWARD", reversalOfId: null, createdAt: { gte: p.from, lte: p.to } },
        _sum: { quantity: true },
      }),
    ]);
    const sold = new Map(out.map((o) => [o.productId, o._sum.quantity ?? 0]));
    const rows = L.products
      .map((pr) => {
        const qty = sum(
          bal.filter((b) => b.productId === pr.id),
          (b) => b.quantity,
        );
        const outQty = sold.get(pr.id) ?? 0;
        return {
          sku: pr.sku,
          name: pr.name,
          qty,
          out: outQty,
          status: outQty === 0 ? "Dead" : outQty < qty * 0.1 ? "Slow" : "",
        };
      })
      .filter((r) => r.qty > 0 && r.status)
      .sort((a, b) => a.out - b.out || b.qty - a.qty);
    return {
      title: "Slow and dead stock (outward in period vs on hand)",
      columns: [
        { key: "sku", header: "SKU" },
        { key: "name", header: "Product" },
        { key: "qty", header: "On hand", kind: "number" },
        { key: "out", header: "Outward in period", kind: "number" },
        { key: "status", header: "Status" },
      ],
      rows,
    };
  },

  async "fast-movers"(db, p) {
    const [L, out] = await Promise.all([
      lookups(db),
      db.stockMovement.groupBy({
        by: ["productId"],
        where: { type: "OUTWARD", reversalOfId: null, createdAt: { gte: p.from, lte: p.to } },
        _sum: { quantity: true },
      }),
    ]);
    const reversed = await db.stockMovement.groupBy({
      by: ["productId"],
      where: { type: "OUTWARD", reversalOfId: { not: null }, createdAt: { gte: p.from, lte: p.to } },
      _sum: { quantity: true },
    });
    const back = new Map(reversed.map((r) => [r.productId, r._sum.quantity ?? 0]));
    const rows = out
      .map((o) => ({
        sku: L.product.get(o.productId)!.sku,
        name: L.product.get(o.productId)!.name,
        out: (o._sum.quantity ?? 0) - (back.get(o.productId) ?? 0),
      }))
      .filter((r) => r.out > 0)
      .sort((a, b) => b.out - a.out)
      .slice(0, 50);
    return {
      title: "Fast movers (net outward in period)",
      columns: [
        { key: "sku", header: "SKU" },
        { key: "name", header: "Product" },
        { key: "out", header: "Outward", kind: "number" },
      ],
      rows,
      totals: { out: sum(rows, (r) => r.out) },
    };
  },

  async "inward-outward"(db, p) {
    const moves = await db.stockMovement.findMany({
      where: { type: { in: ["INWARD", "OUTWARD"] }, createdAt: { gte: p.from, lte: p.to } },
      select: { createdAt: true, type: true, direction: true, quantity: true, reversalOfId: true },
    });
    const days = new Map<string, { date: string; inward: number; outward: number }>();
    for (const m of moves) {
      const d = iso(m.createdAt)!;
      const row = days.get(d) ?? { date: d, inward: 0, outward: 0 };
      // Reversals net out: an INWARD reversal reduces inward, an OUTWARD reversal reduces outward.
      if (m.type === "INWARD") row.inward += m.direction * m.quantity;
      else row.outward += -m.direction * m.quantity;
      days.set(d, row);
    }
    const rows = [...days.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ ...r, net: r.inward - r.outward }));
    return {
      title: "Inward vs outward summary",
      columns: [
        { key: "date", header: "Date", kind: "date" },
        { key: "inward", header: "Inward", kind: "number" },
        { key: "outward", header: "Outward", kind: "number" },
        { key: "net", header: "Net", kind: "number" },
      ],
      rows,
      totals: {
        inward: sum(rows, (r) => r.inward),
        outward: sum(rows, (r) => r.outward),
        net: sum(rows, (r) => r.net),
      },
    };
  },

  async "damage-shortage"(db, p) {
    const [L, lines, writeOffs] = await Promise.all([
      lookups(db),
      db.inwardReceiptLine.findMany({
        where: {
          inwardReceipt: { receivedAt: { gte: p.from, lte: p.to } },
          OR: [{ damagedQuantity: { gt: 0 } }, { shortQuantity: { gt: 0 } }],
        },
        include: { inwardReceipt: { select: { receiptNumber: true, receivedAt: true } } },
      }),
      db.damage.findMany({ where: { status: "POSTED", approvedAt: { gte: p.from, lte: p.to } } }),
    ]);
    const rows = [
      ...lines.map((l) => ({
        date: iso(l.inwardReceipt.receivedAt),
        source: `Receipt ${l.inwardReceipt.receiptNumber}`,
        sku: L.product.get(l.productId)?.sku ?? "",
        damaged: l.damagedQuantity,
        short: l.shortQuantity,
        reason: "On arrival",
      })),
      ...writeOffs.map((w) => ({
        date: iso(w.approvedAt),
        source: `Write-off ${w.damageNumber} (${w.kind.toLowerCase()})`,
        sku: L.product.get(w.productId)?.sku ?? "",
        damaged: w.quantity,
        short: 0,
        reason: w.reason,
      })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return {
      title: "Damage and shortage",
      columns: [
        { key: "date", header: "Date", kind: "date" },
        { key: "source", header: "Source" },
        { key: "sku", header: "SKU" },
        { key: "damaged", header: "Damaged", kind: "number" },
        { key: "short", header: "Short", kind: "number" },
        { key: "reason", header: "Reason" },
      ],
      rows,
      totals: { damaged: sum(rows, (r) => r.damaged), short: sum(rows, (r) => r.short) },
    };
  },

  async "audit-variance"(db, p) {
    const [L, audits] = await Promise.all([
      lookups(db),
      db.stockAudit.findMany({
        where: { status: "CLOSED", closedAt: { gte: p.from, lte: p.to } },
        include: { lines: true },
      }),
    ]);
    const rows = audits.flatMap((a) =>
      a.lines
        .filter((l) => l.countedQuantity != null && l.countedQuantity !== l.systemQuantity)
        .map((l) => ({
          count: a.auditNumber,
          date: iso(a.closedAt),
          tile: L.tile.get(l.locationId)?.code ?? "",
          sku: L.product.get(l.productId)?.sku ?? "",
          system: l.systemQuantity,
          counted: l.countedQuantity!,
          variance: l.countedQuantity! - l.systemQuantity,
          reason: l.varianceReason,
        })),
    );
    return {
      title: "Cycle count variance",
      columns: [
        { key: "count", header: "Count" },
        { key: "date", header: "Approved", kind: "date" },
        { key: "tile", header: "Tile" },
        { key: "sku", header: "SKU" },
        { key: "system", header: "System", kind: "number" },
        { key: "counted", header: "Counted", kind: "number" },
        { key: "variance", header: "Variance", kind: "number" },
        { key: "reason", header: "Reason" },
      ],
      rows,
      totals: { variance: sum(rows, (r) => r.variance) },
    };
  },

  async expiry(db, p) {
    const [L, bal] = await Promise.all([lookups(db), onHand(db)]);
    const by = new Map<
      string,
      { sku: string; name: string; batch: string; expiry: string; days: number; status: string; qty: number }
    >();
    for (const b of bal) {
      const bt = b.batchId ? L.batch.get(b.batchId) : undefined;
      if (!bt?.expiryDate) continue;
      const days = Math.floor((bt.expiryDate.getTime() - p.to.getTime()) / DAY);
      if (days > 90) continue;
      const k = `${b.productId}|${b.batchId}`;
      const row = by.get(k) ?? {
        sku: L.product.get(b.productId)!.sku,
        name: L.product.get(b.productId)!.name,
        batch: bt.batchNo,
        expiry: iso(bt.expiryDate)!,
        days,
        status: days < 0 ? "Expired" : days <= 30 ? "≤30 days" : days <= 60 ? "≤60 days" : "≤90 days",
        qty: 0,
      };
      row.qty += b.quantity;
      by.set(k, row);
    }
    const rows = [...by.values()].sort((a, b) => a.days - b.days);
    return {
      title: "Expiry (expired and within 90 days)",
      columns: [
        { key: "sku", header: "SKU" },
        { key: "name", header: "Product" },
        { key: "batch", header: "Batch" },
        { key: "expiry", header: "Expiry", kind: "date" },
        { key: "days", header: "Days left", kind: "number" },
        { key: "status", header: "Status" },
        { key: "qty", header: "Qty", kind: "number" },
      ],
      rows,
      totals: { qty: sum(rows, (r) => r.qty) },
    };
  },

  async ledger(db, p) {
    const [L, moves] = await Promise.all([
      lookups(db),
      db.stockMovement.findMany({
        where: { createdAt: { gte: p.from, lte: p.to } },
        orderBy: { createdAt: "asc" },
        take: 20000,
        include: { user: { select: { name: true } } },
      }),
    ]);
    const rows = moves.map((m) => ({
      date: m.createdAt.toISOString().slice(0, 16).replace("T", " "),
      type: m.reversalOfId ? `${m.type} (reversal)` : m.type,
      sku: L.product.get(m.productId)?.sku ?? "",
      batch: m.batchId ? (L.batch.get(m.batchId)?.batchNo ?? "-") : "-",
      tile: L.tile.get(m.locationId)?.code ?? "",
      change: m.direction * m.quantity,
      reference: m.reason ?? m.referenceType ?? "",
      user: m.user.name,
    }));
    return {
      title: "Movement ledger",
      columns: [
        { key: "date", header: "When" },
        { key: "type", header: "Type" },
        { key: "sku", header: "SKU" },
        { key: "batch", header: "Batch" },
        { key: "tile", header: "Tile" },
        { key: "change", header: "Change", kind: "number" },
        { key: "reference", header: "Reference" },
        { key: "user", header: "By" },
      ],
      rows,
      totals: { change: sum(rows, (r) => r.change) },
    };
  },

  async "user-activity"(db, p) {
    const logs = await db.auditLog.findMany({
      where: { createdAt: { gte: p.from, lte: p.to } },
      orderBy: { createdAt: "desc" },
      take: 20000,
      include: { user: { select: { name: true, email: true } } },
    });
    const by = new Map<string, { user: string; action: string; count: number; last: string }>();
    for (const l of logs) {
      const k = `${l.userId}|${l.action}`;
      const row = by.get(k) ?? {
        user: l.user ? `${l.user.name} <${l.user.email}>` : "(not signed in)",
        action: l.action,
        count: 0,
        last: l.createdAt.toISOString().slice(0, 16).replace("T", " "),
      };
      row.count++;
      by.set(k, row);
    }
    const rows = [...by.values()].sort((a, b) => a.user.localeCompare(b.user) || b.count - a.count);
    return {
      title: "User activity",
      columns: [
        { key: "user", header: "User" },
        { key: "action", header: "Action" },
        { key: "count", header: "Times", kind: "number" },
        { key: "last", header: "Last" },
      ],
      rows,
      totals: { count: sum(rows, (r) => r.count) },
    };
  },
};

export const REPORT_KEYS = Object.keys(REPORTS);

export function parsePeriod(from?: string | null, to?: string | null): Period {
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
  const start = from ? new Date(`${from}T00:00:00`) : new Date(end.getTime() - 30 * DAY);
  if (isNaN(+start) || isNaN(+end) || start > end) return { from: new Date(Date.now() - 30 * DAY), to: new Date() };
  return { from: start, to: end };
}

export async function runReport(ctx: Context | { db: TenantDb }, key: string, period: Period): Promise<Report | null> {
  const build = REPORTS[key];
  if (!build) return null;
  return { key, ...(await build(ctx.db, period)) };
}
