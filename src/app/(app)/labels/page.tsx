import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { LabelPicker } from "./label-picker";

export const metadata = { title: "Labels" };

export default async function LabelsPage() {
  const ctx = await requirePage("products.view");
  const t = await getTranslations("labels");
  const [products, batches, tiles] = await Promise.all([
    ctx.db.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true },
      orderBy: { sku: "asc" },
    }),
    ctx.db.batch.findMany({
      select: { id: true, batchNo: true, product: { select: { sku: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    ctx.db.location.findMany({ where: { isActive: true }, select: { id: true, code: true }, orderBy: { code: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <LabelPicker
        items={{
          product: products.map((p) => ({ id: p.id, label: `${p.sku} · ${p.name}` })),
          batch: batches.map((b) => ({ id: b.id, label: `${b.product.sku} · ${b.batchNo}` })),
          carton: batches.map((b) => ({ id: b.id, label: `${b.product.sku} · ${b.batchNo}` })),
          tile: tiles.map((x) => ({ id: x.id, label: x.code })),
        }}
      />
    </>
  );
}
