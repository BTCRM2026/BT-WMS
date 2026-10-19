import { getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { fmtNumber } from "@/lib/utils";
import { requirePage } from "@/server/auth/context";
import { ownerSummary } from "@/server/insights";

export const metadata = { title: "Owner view" };

/** Combined summary of all companies (SUPER_ADMIN only: needs company.switch). */
export default async function OwnerPage() {
  await requirePage("company.switch");
  const t = await getTranslations("owner");
  const rows = await ownerSummary();
  const metrics = [
    ["value", t("value"), true],
    ["mrpValue", t("mrpValue"), true],
    ["units", t("units")],
    ["skus", t("skus")],
    ["todayIn", t("todayIn")],
    ["todayOut", t("todayOut")],
    ["lowStock", t("lowStock")],
    ["nearExpiry", t("nearExpiry")],
    ["pendingPutaway", t("pendingPutaway")],
    ["pendingPicks", t("pendingPicks")],
  ] as const;
  const total = (k: string) => rows.reduce((s, r) => s + Number(r[k as keyof typeof r] ?? 0), 0);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Card className="overflow-x-auto" tabIndex={0} aria-label={t("title")}>
        <table className="w-full min-w-[560px] text-sm" data-testid="owner-table">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("metric")}</th>
              {rows.map((r) => (
                <th key={r.id} className="px-4 py-2.5 text-right font-medium">
                  <span
                    className="mr-1.5 inline-block size-2.5 rounded-full"
                    style={{ background: r.brandColor }}
                    aria-hidden
                  />
                  {r.name}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-medium">{t("total")}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(([k, label, money]) => (
              <tr key={k} className="border-t border-line">
                <td className="px-4 py-2.5">{label}</td>
                {rows.map((r) => (
                  <td key={r.id} className="px-4 py-2.5 text-right tabular">
                    {money ? `₹${fmtNumber(Number(r[k]))}` : fmtNumber(Number(r[k]))}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-semibold tabular">
                  {money ? `₹${fmtNumber(total(k))}` : fmtNumber(total(k))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
