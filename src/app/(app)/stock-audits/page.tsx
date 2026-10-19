import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { requirePage } from "@/server/auth/context";
import { NewCount } from "./count-forms";

export const metadata = { title: "Stock audits" };

export default async function StockAuditsPage() {
  const ctx = await requirePage("audit.view");
  const t = await getTranslations("ops");
  const audits = await ctx.db.stockAudit.findMany({
    orderBy: { startedAt: "desc" },
    take: 300,
    include: { lines: true },
  });
  const statuses = Object.fromEntries(
    ["OPEN", "COUNTING", "SUBMITTED", "CLOSED", "CANCELLED"].map((s) => [s, t(`statuses.${s}`)]),
  );
  return (
    <>
      <PageHeader title={t("counts.title")} subtitle={t("counts.subtitle")} />
      <div className="grid gap-6">
        {ctx.can("audit.manage") && <NewCount />}
        <ListTable
          id="stock-audits"
          searchPlaceholder={t("searchDocs")}
          emptyText={t("none")}
          columns={[
            { key: "number", header: t("counts.number"), primary: true },
            { key: "date", header: t("date"), kind: "date" },
            { key: "lines", header: t("lines"), kind: "number" },
            { key: "status", header: t("status"), kind: "badge", tones: STATUS_TONES, labels: statuses },
          ]}
          filters={[
            {
              key: "status",
              label: t("status"),
              options: Object.entries(statuses).map(([value, label]) => ({ value, label })),
            },
          ]}
          rows={audits.map((a) => ({
            id: a.id,
            href: `/stock-audits/${a.id}`,
            number: a.auditNumber,
            date: a.startedAt.toISOString(),
            lines: a.lines.length,
            status: a.status,
          }))}
        />
      </div>
    </>
  );
}
