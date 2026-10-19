import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { lotOptions } from "@/server/ops/queries";
import { TransferForm } from "./transfer-form";

export const metadata = { title: "Transfers" };

export default async function TransfersPage() {
  const ctx = await requirePage("stock.view");
  const t = await getTranslations("ops");
  const recent = await ctx.db.stockMovement.findMany({
    where: { type: "TRANSFER_IN", referenceType: "TRANSFER" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { sku: true, name: true } },
      location: { select: { code: true } },
      user: { select: { name: true } },
    },
  });
  return (
    <>
      <PageHeader title={t("transfer.title")} subtitle={t("transfer.subtitle")} />
      <div className="grid gap-6">
        {ctx.can("stock.move") && <TransferForm lots={await lotOptions(ctx)} />}
        <section>
          <h2 className="mb-3 font-semibold">{t("transfer.recent")}</h2>
          <ListTable
            id="transfers"
            searchPlaceholder={t("searchDocs")}
            emptyText={t("none")}
            columns={[
              { key: "date", header: t("date"), kind: "date" },
              { key: "product", header: t("product"), primary: true },
              { key: "to", header: t("transfer.to"), kind: "mono" },
              { key: "qty", header: t("qty"), kind: "number" },
              { key: "reason", header: t("reason") },
              { key: "user", header: t("ledger.user") },
            ]}
            rows={recent.map((m) => ({
              id: m.id,
              date: m.createdAt.toISOString(),
              product: `${m.product.sku} ${m.product.name}`,
              to: m.location.code,
              qty: m.quantity,
              reason: m.reason,
              user: m.user.name,
            }))}
          />
        </section>
      </div>
    </>
  );
}
