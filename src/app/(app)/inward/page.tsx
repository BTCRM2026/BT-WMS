import { PackageCheck, PackageOpen } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { fmtNumber } from "@/lib/utils";
import { requirePage } from "@/server/auth/context";
import { WriteOffDamaged } from "./damaged";

export const metadata = { title: "Inward receipts" };

export default async function InwardPage() {
  const ctx = await requirePage("inward.view");
  const t = await getTranslations("ops");
  const receipts = await ctx.db.inwardReceipt.findMany({
    orderBy: { receivedAt: "desc" },
    take: 500,
    include: {
      lines: { include: { product: { select: { sku: true, name: true } }, batch: { select: { batchNo: true } } } },
      purchaseOrder: { select: { poNumber: true } },
    },
  });
  const pending = await ctx.db.inwardReceiptLine.count({ where: { putawayAt: null, quantity: { gt: 0 } } });

  // Cartons that arrived damaged, still on the DAMAGED tile, not written off yet.
  const damaged = receipts.flatMap((r) =>
    r.lines.filter((l) => l.damagedQuantity > 0).map((l) => ({ ...l, receipt: r.receiptNumber, receiptId: r.id })),
  );
  const [linked, damagedTile, photos] = await Promise.all([
    ctx.db.damage.findMany({
      where: { receiptLineId: { in: damaged.map((l) => l.id) }, status: { not: "CANCELLED" } },
      select: { receiptLineId: true },
    }),
    ctx.db.location.findFirst({ where: { type: "DAMAGED", isActive: true }, orderBy: { code: "asc" } }),
    ctx.db.attachment.findMany({
      where: { entity: "inward_receipt", entityId: { in: [...new Set(damaged.map((l) => l.receiptId))] } },
      select: { id: true, entityId: true },
    }),
  ]);
  const onTile = damagedTile
    ? await ctx.db.stockBalance.findMany({ where: { locationId: damagedTile.id, quantity: { gt: 0 } } })
    : [];
  const done = new Set(linked.map((d) => d.receiptLineId));
  const open = damaged
    .filter((l) => !done.has(l.id) && onTile.some((b) => b.productId === l.productId && b.batchId === l.batchId))
    .slice(0, 50);

  return (
    <>
      <PageHeader
        title={t("inward.title")}
        subtitle={t("inward.subtitle")}
        actions={
          <>
            <Link href="/inward/putaway" className={buttonVariants({ variant: "secondary" })}>
              <PackageCheck /> {t("inward.putaway")} ({pending})
            </Link>
            {ctx.can("inward.manage") && (
              <Link href="/inward/new" className={buttonVariants()}>
                <PackageOpen /> {t("inward.new")}
              </Link>
            )}
          </>
        }
      />
      {open.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={t("inward.damagedTitle")} hint={t("inward.damagedHint")} />
          <ul className="divide-y divide-line px-4 pb-3 sm:px-5" data-testid="damaged-on-receipt">
            {open.map((l) => {
              const pics = photos.filter((p) => p.entityId === l.receiptId);
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {l.receipt} · {l.product.sku} {l.product.name}
                    </p>
                    <p className="text-muted">
                      {t("batch")} {l.batch?.batchNo ?? "—"} · {t("inward.damaged")} {fmtNumber(l.damagedQuantity)}
                      {pics.map((p, i) => (
                        <span key={p.id}>
                          {" · "}
                          <a href={`/api/attachments/${p.id}`} target="_blank" rel="noreferrer" className="underline">
                            {t("inward.photoN", { n: i + 1 })}
                          </a>
                        </span>
                      ))}
                    </p>
                  </div>
                  {ctx.can("returns.manage") && <WriteOffDamaged lineId={l.id} />}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <ListTable
        id="inward"
        searchPlaceholder={t("searchDocs")}
        emptyText={t("none")}
        columns={[
          { key: "number", header: t("inward.number"), primary: true },
          { key: "po", header: t("inward.against") },
          { key: "date", header: t("date"), kind: "date" },
          { key: "good", header: t("inward.received"), kind: "number" },
          { key: "damaged", header: t("inward.damaged"), kind: "number" },
          { key: "short", header: t("inward.short"), kind: "number" },
          { key: "waiting", header: t("inward.putaway"), kind: "number" },
        ]}
        rows={receipts.map((r) => ({
          id: r.id,
          number: r.receiptNumber,
          po: r.purchaseOrder?.poNumber ?? "—",
          date: r.receivedAt.toISOString(),
          good: r.lines.reduce((s, l) => s + l.quantity, 0),
          damaged: r.lines.reduce((s, l) => s + l.damagedQuantity, 0),
          short: r.lines.reduce((s, l) => s + l.shortQuantity, 0),
          waiting: r.lines.filter((l) => !l.putawayAt).reduce((s, l) => s + l.quantity - l.putawayQuantity, 0),
        }))}
      />
    </>
  );
}
