import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { fmtDate } from "@/lib/utils";
import { requirePage } from "@/server/auth/context";
import { PickLine } from "./pick-line";

export default async function PickListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePage("picking.view");
  const t = await getTranslations("ops");
  const p = await ctx.db.pickList.findUnique({
    where: { id },
    include: {
      salesOrder: true,
      lines: { include: { product: true, batch: true, location: true }, orderBy: { location: { code: "asc" } } },
    },
  });
  if (!p) notFound();
  const done = p.lines.filter((l) => l.confirmedAt).length;
  return (
    <>
      <PageHeader
        title={p.pickNumber}
        subtitle={
          <Link href={`/sales-orders/${p.salesOrderId}`} className="hover:underline">
            {p.salesOrder.orderNumber} · {p.salesOrder.customerName}
          </Link>
        }
        actions={
          <>
            <Badge tone={STATUS_TONES[p.status]}>{t(`statuses.${p.status}`)}</Badge>
            <Badge>{t("pick.progress", { done, total: p.lines.length })}</Badge>
          </>
        }
      />
      {done === p.lines.length && (
        <p className="mb-4 rounded-md bg-success-soft px-4 py-3 text-success">{t("pick.allDone")}</p>
      )}
      <ol className="grid max-w-2xl gap-3" data-testid="pick-lines">
        {p.lines.map((l, i) => (
          <li key={l.id}>
            <PickLine
              index={i + 1}
              canAct={ctx.can("picking.manage") && p.status !== "CANCELLED"}
              line={{
                id: l.id,
                tile: l.location.code,
                sku: l.product.sku,
                name: l.product.name,
                batch: l.batch?.batchNo ?? null,
                expiry: l.batch?.expiryDate ? fmtDate(l.batch.expiryDate) : null,
                qty: l.quantity,
                picked: l.confirmedAt ? l.pickedQuantity : null,
                shortReason: l.shortReason,
              }}
            />
          </li>
        ))}
      </ol>
    </>
  );
}
