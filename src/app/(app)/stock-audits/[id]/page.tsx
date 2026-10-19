import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { STATUS_TONES } from "@/lib/status";
import { fmtDate } from "@/lib/utils";
import { requirePage } from "@/server/auth/context";
import { CountSheet } from "../count-forms";

export default async function StockAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePage("audit.view");
  const t = await getTranslations("ops");
  const a = await ctx.db.stockAudit.findUnique({
    where: { id },
    include: {
      lines: { include: { product: true, batch: true, location: true }, orderBy: [{ location: { code: "asc" } }] },
    },
  });
  if (!a) notFound();
  return (
    <>
      <PageHeader
        title={`${t("counts.number")} ${a.auditNumber}`}
        subtitle={fmtDate(a.startedAt)}
        actions={<Badge tone={STATUS_TONES[a.status]}>{t(`statuses.${a.status}`)}</Badge>}
      />
      <CountSheet
        auditId={a.id}
        status={a.status}
        can={{ count: ctx.can("audit.manage"), approve: ctx.can("stock.approve") }}
        lines={a.lines.map((l) => ({
          id: l.id,
          tile: l.location.code,
          product: `${l.product.sku} ${l.product.name}`,
          batch: l.batch?.batchNo ?? null,
          system: l.systemQuantity,
          counted: l.countedQuantity,
          reason: l.varianceReason,
        }))}
      />
    </>
  );
}
