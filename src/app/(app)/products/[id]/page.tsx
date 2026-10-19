import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { ProductForm } from "./product-form";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePage(id === "new" ? "products.manage" : "products.view");
  const t = await getTranslations("ops.prod");
  const p =
    id === "new" ? null : await ctx.db.product.findUnique({ where: { id }, include: { defaultLocation: true } });
  if (id !== "new" && !p) notFound();
  const tiles = await ctx.db.location.findMany({
    where: { type: "STORAGE", isActive: true },
    select: { code: true },
    orderBy: { code: "asc" },
  });
  return (
    <>
      <PageHeader title={p ? t("editTitle", { sku: p.sku }) : t("newTitle")} />
      <ProductForm
        id={p?.id}
        canEdit={ctx.can("products.manage")}
        isActive={p?.isActive ?? true}
        tiles={tiles.map((x) => x.code)}
        initial={{
          sku: p?.sku ?? "",
          name: p?.name ?? "",
          unit: p?.unit ?? "PCS",
          packSize: p?.packSize ?? 1,
          barcode: p?.barcode ?? "",
          minStock: p?.minStock ?? 0,
          maxStock: p?.maxStock ?? "",
          expiryTracked: p?.expiryTracked ?? true,
          defaultTileCode: p?.defaultLocation?.code ?? "",
          mrp: p ? Number(p.mrp) : 0,
          purchasePrice: p ? Number(p.purchasePrice) : 0,
        }}
      />
    </>
  );
}
