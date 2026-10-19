import { PackageCheck, PackageOpen } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";

export const metadata = { title: "Inward receipts" };

export default async function InwardPage() {
  const ctx = await requirePage("inward.view");
  const t = await getTranslations("ops");
  const receipts = await ctx.db.inwardReceipt.findMany({
    orderBy: { receivedAt: "desc" },
    take: 500,
    include: { lines: true, purchaseOrder: { select: { poNumber: true } } },
  });
  const pending = await ctx.db.inwardReceiptLine.count({ where: { putawayAt: null, quantity: { gt: 0 } } });
  return (
    <>
      <PageHeader
        title={t("inward.title")}
        subtitle={t("inward.subtitle")}
        actions={
          <>
            <Link href="/inward/putaway" className={buttonVariants({ variant: "secondary" })}>
              <PackageCheck /> {t("inward.putaway")} ({pending})
            </Link>
            {ctx.can("inward.manage") && (
              <Link href="/inward/new" className={buttonVariants()}>
                <PackageOpen /> {t("inward.new")}
              </Link>
            )}
          </>
        }
      />
      <ListTable
        id="inward"
        searchPlaceholder={t("searchDocs")}
        emptyText={t("none")}
        columns={[
          { key: "number", header: t("inward.number"), primary: true },
          { key: "po", header: t("inward.against") },
          { key: "date", header: t("date"), kind: "date" },
          { key: "good", header: t("inward.received"), kind: "number" },
          { key: "damaged", header: t("inward.damaged"), kind: "number" },
          { key: "short", header: t("inward.short"), kind: "number" },
          { key: "waiting", header: t("inward.putaway"), kind: "number" },
        ]}
        rows={receipts.map((r) => ({
          id: r.id,
          number: r.receiptNumber,
          po: r.purchaseOrder?.poNumber ?? "—",
          date: r.receivedAt.toISOString(),
          good: r.lines.reduce((s, l) => s + l.quantity, 0),
          damaged: r.lines.reduce((s, l) => s + l.damagedQuantity, 0),
          short: r.lines.reduce((s, l) => s + l.shortQuantity, 0),
          waiting: r.lines.filter((l) => !l.putawayAt && l.quantity > 0).reduce((s, l) => s + l.quantity, 0),
        }))}
      />
    </>
  );
}
