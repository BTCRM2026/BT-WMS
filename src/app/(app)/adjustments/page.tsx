import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";

export const metadata = { title: "Adjustments" };

export default async function AdjustmentsPage() {
  const ctx = await requirePage("stock.view");
  const t = await getTranslations("ops");
  const list = await ctx.db.adjustment.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { product: true, batch: true, location: true, stockAudit: { select: { id: true, auditNumber: true } } },
  });
  return (
    <>
      <PageHeader title={t("adjustments.title")} subtitle={t("adjustments.subtitle")} />
      <ListTable
        id="adjustments"
        searchPlaceholder={t("searchDocs")}
        emptyText={t("none")}
        columns={[
          { key: "number", header: t("adjustments.number"), primary: true },
          { key: "date", header: t("date"), kind: "date" },
          { key: "product", header: t("product") },
          { key: "tile", header: t("tile"), kind: "mono" },
          { key: "batch", header: t("batch") },
          { key: "change", header: t("adjustments.direction"), kind: "number" },
          { key: "reason", header: t("reason") },
          { key: "count", header: t("counts.number") },
        ]}
        rows={list.map((a) => ({
          id: a.id,
          href: a.stockAudit ? `/stock-audits/${a.stockAudit.id}` : undefined,
          number: a.adjustmentNumber,
          date: (a.approvedAt ?? a.createdAt).toISOString(),
          product: `${a.product.sku} ${a.product.name}`,
          tile: a.location.code,
          batch: a.batch?.batchNo ?? "—",
          change: a.direction * a.quantity,
          reason: a.reason,
          count: a.stockAudit?.auditNumber ?? "—",
        }))}
      />
    </>
  );
}
