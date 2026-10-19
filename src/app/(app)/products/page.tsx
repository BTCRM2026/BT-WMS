import { Plus, Upload } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { stockByProduct } from "@/server/insights";
import { ProductsTable } from "./table";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const ctx = await requirePage("products.view");
  const t = await getTranslations("products");
  const to = await getTranslations("ops");
  const [products, stock] = await Promise.all([
    ctx.db.product.findMany({
      orderBy: { sku: "asc" },
      take: 2000, // ponytail: client-side paging; switch to server paging past a few thousand SKUs
      include: { defaultLocation: { select: { code: true } } },
    }),
    stockByProduct(ctx.db),
  ]);

  const rows = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    packSize: p.packSize,
    barcode: p.barcode,
    minStock: p.minStock,
    mrp: Number(p.mrp),
    location: p.defaultLocation?.code ?? null,
    stock: stock.get(p.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { company: ctx.company.name })}
        actions={
          ctx.can("products.manage") && (
            <>
              <Link href="/products/import" className={buttonVariants({ variant: "secondary" })}>
                <Upload /> {to("prod.import")}
              </Link>
              <Link href="/products/new" className={buttonVariants()}>
                <Plus /> {to("prod.newTitle")}
              </Link>
            </>
          )
        }
      />
      <ProductsTable rows={rows} />
    </>
  );
}
