import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { fmtDate, fmtNumber } from "@/lib/utils";
import { requirePage } from "@/server/auth/context";
import { productOptions } from "@/server/ops/options";
import { NewSalesOrder, OrderActions, DispatchCancel } from "./order-forms";

export default async function SalesOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("ops");
  if (id === "new") {
    const ctx = await requirePage("sales.manage");
    return (
      <>
        <PageHeader title={t("so.new")} subtitle={t("draftKept")} />
        <NewSalesOrder products={await productOptions(ctx)} />
      </>
    );
  }
  const ctx = await requirePage("sales.view");
  const so = await ctx.db.salesOrder.findUnique({
    where: { id },
    include: {
      lines: { include: { product: true } },
      pickLists: { include: { lines: true }, orderBy: { createdAt: "asc" } },
      dispatches: { include: { lines: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!so) notFound();

  const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
  const livePicks = so.pickLists.filter((p) => p.status !== "CANCELLED");
  const posted = so.dispatches.filter((d) => d.status === "POSTED");
  const per = (pid: string) => ({
    allocated: sum(
      livePicks.flatMap((p) => p.lines).filter((l) => l.productId === pid),
      (l) => (l.confirmedAt ? l.pickedQuantity : l.quantity),
    ),
    picked: sum(
      livePicks.flatMap((p) => p.lines).filter((l) => l.productId === pid && l.confirmedAt),
      (l) => l.pickedQuantity,
    ),
    dispatched: sum(
      posted.flatMap((d) => d.lines).filter((l) => l.productId === pid),
      (l) => l.quantity,
    ),
  });
  const rows = so.lines.map((l) => ({ ...l, ...per(l.productId) }));
  const needsPick = rows.some((r) => r.allocated < r.quantity);
  const allConfirmed = livePicks.length > 0 && livePicks.every((p) => p.lines.every((l) => l.confirmedAt));
  const readyQty = sum(rows, (r) => r.picked) - sum(rows, (r) => r.dispatched);
  const open = !["DISPATCHED", "CANCELLED"].includes(so.status);

  return (
    <>
      <PageHeader
        title={`${t("so.number")} ${so.orderNumber}`}
        subtitle={`${so.customerName} · ${fmtDate(so.orderDate)}`}
        actions={<Badge tone={STATUS_TONES[so.status]}>{t(`statuses.${so.status}`)}</Badge>}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-x-auto xl:col-span-2">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("product")}</th>
                {(["ordered", "allocated", "picked", "dispatched"] as const).map((k) => (
                  <th key={k} className="px-4 py-2.5 text-right font-medium">
                    {t(`so.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-muted">{r.product.sku}</span> {r.product.name}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">{fmtNumber(r.quantity)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{fmtNumber(r.allocated)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{fmtNumber(r.picked)}</td>
                  <td className="px-4 py-2.5 text-right tabular">{fmtNumber(r.dispatched)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {open && (
          <OrderActions
            salesOrderId={so.id}
            can={{
              pick: ctx.can("picking.manage"),
              dispatch: ctx.can("dispatch.manage"),
              sales: ctx.can("sales.manage"),
            }}
            state={{
              needsPick,
              allConfirmed,
              packed: so.status === "PACKED",
              readyQty,
              hasDispatch: posted.length > 0,
            }}
          />
        )}

        <Card>
          <CardHeader title={t("so.pickLists")} />
          <ul className="divide-y divide-line px-4 pb-3 sm:px-5">
            {so.pickLists.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                <Link href={`/picking/${p.id}`} className="font-medium hover:underline">
                  {p.pickNumber}
                </Link>
                <Badge tone={STATUS_TONES[p.status]}>{t(`statuses.${p.status}`)}</Badge>
              </li>
            ))}
            {!so.pickLists.length && <li className="py-3 text-sm text-muted">{t("none")}</li>}
          </ul>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title={t("so.dispatches")} />
          <ul className="divide-y divide-line px-4 pb-3 sm:px-5">
            {so.dispatches.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{d.dispatchNumber}</span> · {d.vehicleNo} ·{" "}
                  {fmtNumber(sum(d.lines, (l) => l.quantity))} {t("qty").toLowerCase()} · {fmtDate(d.dispatchedAt)}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_TONES[d.status]}>{t(`statuses.${d.status}`)}</Badge>
                  <a
                    href={`/api/dispatches/${d.id}/challan`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <FileText className="size-4" aria-hidden /> {t("so.challan")}
                  </a>
                  {d.status === "POSTED" && ctx.can("dispatch.manage") && <DispatchCancel dispatchId={d.id} />}
                </span>
              </li>
            ))}
            {!so.dispatches.length && <li className="py-3 text-sm text-muted">{t("none")}</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
