import { PackageOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { fmtDate, fmtNumber } from "@/lib/utils";
import { requirePage } from "@/server/auth/context";
import { productOptions } from "@/server/ops/options";
import { NewPurchaseOrder } from "./new-po";

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("ops");
  if (id === "new") {
    const ctx = await requirePage("purchase.manage");
    return (
      <>
        <PageHeader title={t("po.new")} subtitle={t("draftKept")} />
        <NewPurchaseOrder products={await productOptions(ctx)} />
      </>
    );
  }
  const ctx = await requirePage("purchase.view");
  const po = await ctx.db.purchaseOrder.findUnique({
    where: { id },
    include: { lines: { include: { product: true } } },
  });
  if (!po) notFound();
  const got = await ctx.db.inwardReceiptLine.groupBy({
    by: ["productId"],
    where: { inwardReceipt: { purchaseOrderId: po.id, status: "POSTED" } },
    _sum: { quantity: true, damagedQuantity: true },
  });
  const receivedOf = (pid: string) =>
    got
      .filter((g) => g.productId === pid)
      .reduce((s, g) => s + (g._sum.quantity ?? 0) + (g._sum.damagedQuantity ?? 0), 0);
  return (
    <>
      <PageHeader
        title={`${t("po.number")} ${po.poNumber}`}
        subtitle={`${po.supplierName} · ${fmtDate(po.orderDate)}${po.expectedDate ? ` · ${t("po.expected")} ${fmtDate(po.expectedDate)}` : ""}`}
        actions={
          <>
            <Badge tone={STATUS_TONES[po.status]}>{t(`statuses.${po.status}`)}</Badge>
            {ctx.can("inward.manage") && (po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED") && (
              <Link href={`/inward/new?po=${po.id}`} className={buttonVariants()}>
                <PackageOpen /> {t("po.receive")}
              </Link>
            )}
          </>
        }
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("product")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("po.ordered")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("po.received")}</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs text-muted">{l.product.sku}</span> {l.product.name}
                </td>
                <td className="px-4 py-2.5 text-right tabular">{fmtNumber(l.quantity)}</td>
                <td className="px-4 py-2.5 text-right tabular">{fmtNumber(receivedOf(l.productId))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
