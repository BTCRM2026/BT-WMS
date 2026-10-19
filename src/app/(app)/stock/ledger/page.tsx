import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { Button } from "@/components/ui/button";
import { Card, Field, Input, PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { productOptions } from "@/server/ops/options";

export const metadata = { title: "Movement ledger" };

const TONES = {
  INWARD: "success",
  TRANSFER_IN: "info",
  RETURN: "info",
  OUTWARD: "brand",
  TRANSFER_OUT: "neutral",
  DAMAGE: "danger",
  ADJUSTMENT: "warning",
} as const;

/** Full movement history for a product and/or tile (the "what happened here" view). */
export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; tile?: string }>;
}) {
  const ctx = await requirePage("stock.view");
  const t = await getTranslations("ops");
  const { product, tile } = await searchParams;
  const location = tile ? await ctx.db.location.findFirst({ where: { code: tile.toUpperCase() } }) : null;
  const products = await productOptions(ctx);
  const moves = await ctx.db.stockMovement.findMany({
    where: { productId: product || undefined, locationId: tile ? (location?.id ?? "none") : undefined },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      product: { select: { sku: true, name: true } },
      batch: { select: { batchNo: true } },
      location: { select: { code: true } },
      user: { select: { name: true } },
    },
  });
  return (
    <>
      <PageHeader title={t("ledger.title")} subtitle={t("ledger.subtitle")} />
      <Card className="mb-4 p-4">
        <form className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <Field label={t("ledger.filterProduct")} htmlFor="product">
            <select
              id="product"
              name="product"
              defaultValue={product ?? ""}
              className="h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-sm pointer-coarse:h-11"
            >
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("ledger.filterTile")} htmlFor="tile">
            <Input
              id="tile"
              name="tile"
              defaultValue={tile ?? ""}
              className="font-mono uppercase"
              placeholder="BT-A-01-1"
            />
          </Field>
          <Button type="submit">{t("ledger.apply")}</Button>
        </form>
      </Card>
      <ListTable
        id="ledger"
        searchPlaceholder={t("searchDocs")}
        emptyText={t("none")}
        exportName="ledger"
        columns={[
          { key: "date", header: t("date"), kind: "date" },
          { key: "type", header: t("ledger.type"), kind: "badge", tones: TONES },
          { key: "product", header: t("product"), primary: true },
          { key: "batch", header: t("batch") },
          { key: "tile", header: t("tile"), kind: "mono" },
          { key: "change", header: t("ledger.change"), kind: "number" },
          { key: "reference", header: t("ledger.reference") },
          { key: "user", header: t("ledger.user") },
        ]}
        rows={moves.map((m) => ({
          id: m.id,
          date: m.createdAt.toISOString(),
          type: m.reversalOfId ? `${m.type} (reversal)` : m.type,
          product: `${m.product.sku} ${m.product.name}`,
          batch: m.batch?.batchNo ?? "—",
          tile: m.location.code,
          change: m.direction * m.quantity,
          reference: m.reason ?? m.referenceType ?? "",
          user: m.user.name,
        }))}
      />
    </>
  );
}
