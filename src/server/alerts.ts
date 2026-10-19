import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { tenantDb, type TenantDb } from "@/server/db/tenant";
import { logger } from "@/server/log";
import { lowStock, stockByBatch } from "@/server/insights";

const DAY = 86_400_000;
export const EXPIRY_THRESHOLDS = [90, 60, 30] as const;
const PENDING_HOURS = { putaway: 24, pick: 24, writeOff: 48, count: 48 };

type Candidate = { kind: string; key: string; message: string };

/** Everything that deserves an alert right now, each with a stable key. */
export async function candidates(db: TenantDb, now = new Date()): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const p of await lowStock(db))
    out.push({
      kind: "low-stock",
      key: p.id,
      message: `${p.sku} ${p.name} is below minimum: ${p.qty} / ${p.minStock}`,
    });

  const onHand = await stockByBatch(db);
  const batches = await db.batch.findMany({
    where: { id: { in: [...onHand.keys()] }, expiryDate: { lte: new Date(now.getTime() + 90 * DAY) } },
    include: { product: { select: { sku: true, name: true } } },
  });
  for (const b of batches) {
    const days = Math.floor((b.expiryDate!.getTime() - now.getTime()) / DAY);
    // The tightest threshold reached: 30, else 60, else 90 (each fires once per batch).
    const t = [...EXPIRY_THRESHOLDS].reverse().find((x) => days <= x)!;
    out.push({
      kind: `expiry-${t}`,
      key: b.id,
      message:
        days < 0
          ? `${b.product.sku} batch ${b.batchNo} has EXPIRED (${onHand.get(b.id)} units)`
          : `${b.product.sku} batch ${b.batchNo} expires in ${days} days (${onHand.get(b.id)} units)`,
    });
  }

  const ago = (h: number) => new Date(now.getTime() - h * 3600_000);
  const [putaways, picks, writeOffs, counts] = await Promise.all([
    db.inwardReceiptLine.findMany({
      where: {
        putawayAt: null,
        quantity: { gt: 0 },
        inwardReceipt: { receivedAt: { lt: ago(PENDING_HOURS.putaway) } },
      },
      include: { product: { select: { sku: true } } },
    }),
    db.pickList.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, createdAt: { lt: ago(PENDING_HOURS.pick) } },
    }),
    db.damage.findMany({ where: { status: "DRAFT", createdAt: { lt: ago(PENDING_HOURS.writeOff) } } }),
    db.stockAudit.findMany({ where: { status: "SUBMITTED", startedAt: { lt: ago(PENDING_HOURS.count) } } }),
  ]);
  for (const l of putaways)
    out.push({
      kind: "pending-putaway",
      key: l.id,
      message: `${l.quantity} × ${l.product.sku} waiting for putaway for over ${PENDING_HOURS.putaway} h`,
    });
  for (const p of picks)
    out.push({
      kind: "pending-pick",
      key: p.id,
      message: `Pick list ${p.pickNumber} open for over ${PENDING_HOURS.pick} h`,
    });
  for (const w of writeOffs)
    out.push({ kind: "pending-approval", key: w.id, message: `Write-off ${w.damageNumber} waiting for approval` });
  for (const c of counts)
    out.push({ kind: "pending-approval", key: c.id, message: `Cycle count ${c.auditNumber} waiting for approval` });
  return out;
}

/**
 * Record new alerts for one company. The (company, kind, key) unique index makes
 * every alert fire exactly once; a low-stock alert is cleared when the product
 * recovers so it can fire again next time it dips.
 */
export async function raiseAlerts(companyId: string, now = new Date()) {
  const db = tenantDb(companyId);
  const list = await candidates(db, now);
  const fresh = await db.alertEvent.createManyAndReturn({
    data: list.map((c) => ({ companyId, kind: c.kind, key: c.key, message: c.message })),
    skipDuplicates: true,
  });
  const lowNow = new Set(list.filter((c) => c.kind === "low-stock").map((c) => c.key));
  await db.alertEvent.deleteMany({ where: { kind: "low-stock", key: { notIn: [...lowNow] } } });
  return fresh;
}

// ------------------------------------------------------------------ delivery

/** Swap providers without touching callers: console (default) or a webhook (email/WhatsApp gateway). */
export interface Notifier {
  send(message: { to: string[]; subject: string; text: string }): Promise<void>;
}

export const consoleNotifier: Notifier = {
  async send(m) {
    logger.info("digest", { to: m.to, subject: m.subject, text: m.text });
  },
};

/** POSTs {to, subject, text} as JSON; point DIGEST_WEBHOOK_URL at an email or WhatsApp gateway. */
export const webhookNotifier = (url: string): Notifier => ({
  async send(m) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(m),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`Digest webhook answered ${r.status}`);
  },
});

export const defaultNotifier = (): Notifier =>
  process.env.DIGEST_WEBHOOK_URL ? webhookNotifier(process.env.DIGEST_WEBHOOK_URL) : consoleNotifier;

/** Plain text that reads well in email and WhatsApp alike. */
export function digestText(company: string, alerts: { kind: string; message: string }[]) {
  if (!alerts.length) return `${company}: no new alerts today.`;
  const groups: [string, string][] = [
    ["low-stock", "Low stock"],
    ["expiry-30", "Expiring within 30 days"],
    ["expiry-60", "Expiring within 60 days"],
    ["expiry-90", "Expiring within 90 days"],
    ["pending-putaway", "Waiting for putaway"],
    ["pending-pick", "Open pick lists"],
    ["pending-approval", "Waiting for approval"],
  ];
  const lines = [`*${company}* daily warehouse digest`];
  for (const [kind, title] of groups) {
    const items = alerts.filter((a) => a.kind === kind);
    if (items.length) lines.push("", `${title} (${items.length}):`, ...items.slice(0, 20).map((a) => `- ${a.message}`));
  }
  return lines.join("\n");
}

/**
 * The daily job. A JobRun row keyed by the date makes it run once per day even
 * with several app instances or a manual trigger at the same time.
 */
export async function runDailyDigest(now = new Date(), notifier: Notifier = defaultNotifier()) {
  const runKey = `daily-digest:${now.toISOString().slice(0, 10)}`;
  try {
    await prisma.jobRun.create({ data: { job: "daily-digest", runKey } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { skipped: true as const };
    throw e;
  }
  const companies = await prisma.company.findMany({ include: { users: false } });
  const result: Record<string, number> = {};
  for (const c of companies) {
    const fresh = await raiseAlerts(c.id, now);
    result[c.slug] = fresh.length;
    const settings = await prisma.companySetting.findUnique({ where: { companyId: c.id } });
    const to = (settings?.digestRecipients ?? "").split(/[,;\s]+/).filter(Boolean);
    if (fresh.length && to.length) {
      await notifier.send({
        to,
        subject: `${c.name}: ${fresh.length} new warehouse alert(s)`,
        text: digestText(c.name, fresh),
      });
      await prisma.alertEvent.updateMany({
        where: { id: { in: fresh.map((f) => f.id) } },
        data: { sentAt: new Date() },
      });
    }
  }
  await prisma.jobRun.update({ where: { runKey }, data: { finishedAt: new Date(), result } });
  return { skipped: false as const, result };
}
