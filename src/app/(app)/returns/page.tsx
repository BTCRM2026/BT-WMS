import { getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { fmtDate, fmtNumber } from "@/lib/utils";
import { requirePage } from "@/server/auth/context";
import { productOptions } from "@/server/ops/options";
import { InspectReturn, ReturnForm } from "./return-forms";

export const metadata = { title: "Returns" };

export default async function ReturnsPage() {
  const ctx = await requirePage("returns.view");
  const t = await getTranslations("ops");
  const [returns, products, orders] = await Promise.all([
    ctx.db.stockReturn.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { product: true, batch: true, salesOrder: true },
    }),
    productOptions(ctx),
    ctx.db.salesOrder.findMany({
      where: { status: "DISPATCHED" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, orderNumber: true, customerName: true },
    }),
  ]);
  const canAct = ctx.can("returns.manage");
  return (
    <>
      <PageHeader title={t("returns.title")} subtitle={t("returns.subtitle")} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {canAct && (
          <ReturnForm
            products={products}
            orders={orders.map((o) => ({
              id: o.id,
              label: `${o.orderNumber} · ${o.customerName}`,
              customer: o.customerName,
            }))}
          />
        )}
        <Card>
          <CardHeader title={t("returns.title")} />
          {returns.length === 0 ? (
            <EmptyState title={t("none")} />
          ) : (
            <ul className="divide-y divide-line px-4 pb-3 sm:px-5" data-testid="returns-list">
              {returns.map((r) => (
                <li key={r.id} className="grid gap-2 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {r.returnNumber} · {r.product.sku} {r.product.name}
                      </p>
                      <p className="text-muted">
                        {r.customerName ?? r.salesOrder?.customerName} · {t("batch")} {r.batch?.batchNo ?? "—"} ·{" "}
                        {fmtNumber(r.quantity)} · {fmtDate(r.createdAt)} · {r.reason}
                      </p>
                      {r.disposition && <p className="text-muted">{t(`returns.${r.disposition}`)}</p>}
                    </div>
                    <Badge tone={STATUS_TONES[r.status]}>{t(`statuses.${r.status}`)}</Badge>
                  </div>
                  {canAct && r.status === "RECEIVED" && <InspectReturn returnId={r.id} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
