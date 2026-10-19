import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { requirePage } from "@/server/auth/context";

export const metadata = { title: "Sales orders" };

export default async function SalesOrdersPage() {
  const ctx = await requirePage("sales.view");
  const t = await getTranslations("ops");
  const orders = await ctx.db.salesOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { lines: true },
  });
  const statuses = Object.fromEntries(
    ["CONFIRMED", "PICKING", "PACKED", "DISPATCHED", "CANCELLED"].map((s) => [s, t(`statuses.${s}`)]),
  );
  return (
    <>
      <PageHeader
        title={t("so.title")}
        subtitle={t("so.subtitle")}
        actions={
          ctx.can("sales.manage") && (
            <Link href="/sales-orders/new" className={buttonVariants()}>
              <Plus /> {t("so.new")}
            </Link>
          )
        }
      />
      <ListTable
        id="sales-orders"
        searchPlaceholder={t("searchDocs")}
        emptyText={t("none")}
        columns={[
          { key: "number", header: t("so.number"), primary: true },
          { key: "customer", header: t("customer") },
          { key: "date", header: t("date"), kind: "date" },
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
        rows={orders.map((o) => ({
          id: o.id,
          href: `/sales-orders/${o.id}`,
          number: o.orderNumber,
          customer: o.customerName,
          date: o.orderDate.toISOString(),
          units: o.lines.reduce((s, l) => s + l.quantity, 0),
          status: o.status,
        }))}
      />
    </>
  );
}
