import { FileDown, FileSpreadsheet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { Button } from "@/components/ui/button";
import { Card, Field, Input, PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { parsePeriod, REPORT_KEYS, runReport } from "@/server/reports";

export const metadata = { title: "Reports" };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; from?: string; to?: string }>;
}) {
  const ctx = await requirePage("reports.view");
  const t = await getTranslations("reports");
  const q = await searchParams;
  const key = q.report && REPORT_KEYS.includes(q.report) ? q.report : "stock-product";
  const period = parsePeriod(q.from, q.to);
  const report = (await runReport(ctx, key, period))!;
  const qs = `from=${ymd(period.from)}&to=${ymd(period.to)}`;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { company: ctx.company.name })}
        actions={
          <>
            <a
              href={`/api/reports/${key}?${qs}&format=xlsx`}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-medium shadow-sm hover:bg-surface-2"
            >
              <FileSpreadsheet className="size-4" aria-hidden /> Excel
            </a>
            <a
              href={`/api/reports/${key}?${qs}&format=pdf`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-medium shadow-sm hover:bg-surface-2"
            >
              <FileDown className="size-4" aria-hidden /> PDF
            </a>
          </>
        }
      />
      <Card className="mb-4 p-4">
        <form className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <Field label={t("report")} htmlFor="report">
            <select
              id="report"
              name="report"
              defaultValue={key}
              className="h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-sm pointer-coarse:h-11"
            >
              {REPORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(`names.${k}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("from")} htmlFor="from">
            <Input id="from" name="from" type="date" defaultValue={ymd(period.from)} />
          </Field>
          <Field label={t("to")} htmlFor="to">
            <Input id="to" name="to" type="date" defaultValue={ymd(period.to)} />
          </Field>
          <Button type="submit">{t("run")}</Button>
        </form>
      </Card>
      <h2 className="mb-2 font-semibold" data-testid="report-title">
        {report.title}
      </h2>
      {report.totals && (
        <p className="mb-3 text-sm text-muted" data-testid="report-totals">
          {Object.entries(report.totals)
            .map(([k, v]) => `${report.columns.find((c) => c.key === k)?.header ?? k}: ${v.toLocaleString("en-IN")}`)
            .join(" · ")}
        </p>
      )}
      <ListTable
        id={`report-${key}`}
        searchPlaceholder={t("search")}
        emptyText={t("empty")}
        exportName={`${ctx.company.slug}-${key}`}
        columns={report.columns.map((c, i) => ({
          key: c.key,
          header: c.header,
          kind: c.kind === "money" ? "number" : c.kind === "date" ? "date" : c.kind === "number" ? "number" : "text",
          primary: i === 0,
        }))}
        rows={report.rows.map((r, i) => ({ id: String(i), ...r }))}
      />
    </>
  );
}
