import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { requirePage } from "@/server/auth/context";

export const metadata = { title: "Dispatch" };

export default async function DispatchPage() {
  const ctx = await requirePage("dispatch.view");
  const t = await getTranslations("ops");
  const list = await ctx.db.dispatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { lines: true, salesOrder: true },
  });
  return (
    <>
      <PageHeader title={t("dispatch.title")} subtitle={t("dispatch.subtitle")} />
      <ListTable
        id="dispatch"
        searchPlaceholder={t("searchDocs")}
        emptyText={t("none")}
        columns={[
          { key: "number", header: t("dispatch.number"), primary: true },
          { key: "order", header: t("so.number") },
          { key: "customer", header: t("customer") },
          { key: "date", header: t("date"), kind: "date" },
          { key: "vehicle", header: t("so.vehicle"), kind: "mono" },
          { key: "lr", header: t("so.lr") },
          { key: "transporter", header: t("so.transporter"), defaultHidden: true },
          { key: "units", header: t("qty"), kind: "number" },
          {
            key: "status",
            header: t("status"),
            kind: "badge",
            tones: STATUS_TONES,
            labels: { POSTED: t("statuses.POSTED"), CANCELLED: t("statuses.CANCELLED") },
          },
        ]}
        rows={list.map((d) => ({
          id: d.id,
          href: `/sales-orders/${d.salesOrderId}`,
          number: d.dispatchNumber,
          order: d.salesOrder.orderNumber,
          customer: d.salesOrder.customerName,
          date: d.dispatchedAt?.toISOString() ?? null,
          vehicle: d.vehicleNo,
          lr: d.lrNumber,
          transporter: d.transporter,
          units: d.lines.reduce((s, l) => s + l.quantity, 0),
          status: d.status,
        }))}
      />
    </>
  );
}
