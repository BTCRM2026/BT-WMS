import { getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { fmtDate, fmtNumber } from "@/lib/utils";
import { requirePage } from "@/server/auth/context";
import { lotOptions } from "@/server/ops/queries";
import { DecideWriteOff, WriteOffForm } from "./damage-forms";

export const metadata = { title: "Write-offs" };

export default async function DamagesPage() {
  const ctx = await requirePage("returns.view");
  const t = await getTranslations("ops");
  const list = await ctx.db.damage.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { product: true, batch: true, location: true },
  });
  return (
    <>
      <PageHeader title={t("damages.title")} subtitle={t("damages.subtitle")} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {ctx.can("returns.manage") && <WriteOffForm lots={await lotOptions(ctx)} />}
        <Card>
          <CardHeader title={t("damages.title")} />
          {list.length === 0 ? (
            <EmptyState title={t("none")} />
          ) : (
            <ul className="divide-y divide-line px-4 pb-3 sm:px-5" data-testid="writeoff-list">
              {list.map((d) => (
                <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {d.damageNumber} · {t(`damages.${d.kind}`)} · {d.product.sku} {d.product.name}
                    </p>
                    <p className="text-muted">
                      {d.location.code} · {t("batch")} {d.batch?.batchNo ?? "—"} · {fmtNumber(d.quantity)} ·{" "}
                      {fmtDate(d.createdAt)} · {d.reason}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONES[d.status]}>
                      {d.status === "DRAFT" ? t("damages.needsApproval") : t(`statuses.${d.status}`)}
                    </Badge>
                    {d.status === "DRAFT" && ctx.can("stock.approve") && <DecideWriteOff id={d.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
