import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { productOptions } from "@/server/ops/options";
import { ReceiveForm } from "./receive-form";

export const metadata = { title: "Receive goods" };

export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ po?: string }> }) {
  const ctx = await requirePage("inward.manage");
  const t = await getTranslations("ops");
  const { po: poId } = await searchParams;
  const [products, openPos] = await Promise.all([
    productOptions(ctx),
    ctx.db.purchaseOrder.findMany({
      where: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } },
      include: { lines: { select: { productId: true, quantity: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  return (
    <>
      <PageHeader title={t("inward.new")} subtitle={t("draftKept")} />
      <ReceiveForm
        products={products}
        pos={openPos.map((p) => ({ id: p.id, label: `${p.poNumber} · ${p.supplierName}`, lines: p.lines }))}
        initialPo={poId ?? ""}
      />
    </>
  );
}
