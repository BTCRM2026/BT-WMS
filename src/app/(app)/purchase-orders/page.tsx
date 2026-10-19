import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { requirePage } from "@/server/auth/context";

export const metadata = { title: "Purchase orders" };

export default async function PurchaseOrdersPage() {
  const ctx = await requirePage("purchase.view");
  const t = await getTranslations("ops");
  const pos = await ctx.db.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { lines: true },
  });
  const statuses = Object.fromEntries(
    ["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED", "DRAFT"].map((s) => [s, t(`statuses.${s}`)]),
  );
  return (
    <>
      <PageHeader
        title={t("po.title")}
        subtitle={t("po.subtitle")}
        actions={
          ctx.can("purchase.manage") && (
            <Link href="/purchase-orders/new" className={buttonVariants()}>
              <Plus /> {t("po.new")}
            </Link>
          )
        }
      />
      <ListTable
        id="purchase-orders"
        searchPlaceholder={t("searchDocs")}
        emptyText={t("none")}
        columns={[
          { key: "number", header: t("po.number"), primary: true },
          { key: "supplier", header: t("supplier") },
          { key: "date", header: t("date"), kind: "date" },
          { key: "expected", header: t("po.expected"), kind: "date" },
          { key: "units", header: t("qty"), kind: "number" },
          { key: "status", header: t("status"), kind: "badge", tones: STATUS_TONES, labels: statuses },
        ]}
        filters={[
          {
            key: "status",
            label: t("status"),
            options: Object.entries(statuses).map(([value, label]) => ({ value, label })),
          },
        ]}
        rows={pos.map((p) => ({
          id: p.id,
          href: `/purchase-orders/${p.id}`,
          number: p.poNumber,
          supplier: p.supplierName,
          date: p.orderDate.toISOString(),
          expected: p.expectedDate?.toISOString() ?? null,
          units: p.lines.reduce((s, l) => s + l.quantity, 0),
          status: p.status,
        }))}
      />
    </>
  );
}
