import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { requirePage } from "@/server/auth/context";

export const metadata = { title: "Pick lists" };

export default async function PickingPage() {
  const ctx = await requirePage("picking.view");
  const t = await getTranslations("ops");
  const lists = await ctx.db.pickList.findMany({
    where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    include: { lines: true, salesOrder: { select: { orderNumber: true, customerName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <>
      <PageHeader title={t("pick.title")} subtitle={t("pick.subtitle")} />
      {lists.length === 0 ? (
        <Card>
          <EmptyState title={t("none")} />
        </Card>
      ) : (
        <ul className="grid max-w-3xl gap-3">
          {lists.map((p) => (
            <li key={p.id}>
              <Link href={`/picking/${p.id}`} className="block rounded-lg">
                <Card className="flex min-h-20 items-center justify-between gap-3 p-4 transition-colors hover:border-line-strong">
                  <div>
                    <p className="font-semibold">{p.pickNumber}</p>
                    <p className="text-sm text-muted">
                      {p.salesOrder.orderNumber} · {p.salesOrder.customerName}
                    </p>
                    <p className="mt-1 text-sm">
                      {t("pick.progress", { done: p.lines.filter((l) => l.confirmedAt).length, total: p.lines.length })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONES[p.status]}>{t(`statuses.${p.status}`)}</Badge>
                    <ChevronRight className="size-5 text-muted" aria-hidden />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
