import { getTranslations } from "next-intl/server";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { putawayQueue, suggestFor } from "@/server/ops/inward";
import { PutawayCard } from "./putaway-card";

export const metadata = { title: "Putaway" };

export default async function PutawayPage() {
  const ctx = await requirePage("inward.view");
  const t = await getTranslations("ops.inward");
  const queue = await putawayQueue(ctx);
  const suggestions = await Promise.all(queue.map((l) => suggestFor(ctx, l.id)));
  return (
    <>
      <PageHeader title={t("putawayTitle")} subtitle={t("putawaySubtitle")} />
      {queue.length === 0 ? (
        <Card>
          <EmptyState title={t("queueEmpty")} />
        </Card>
      ) : (
        <ul className="grid max-w-3xl gap-3" data-testid="putaway-queue">
          {queue.map((l, i) => (
            <li key={l.id}>
              <PutawayCard
                canAct={ctx.can("inward.manage")}
                line={{
                  id: l.id,
                  sku: l.product.sku,
                  name: l.product.name,
                  batch: l.batch?.batchNo ?? null,
                  qty: l.quantity,
                  receipt: l.inwardReceipt.receiptNumber,
                }}
                suggestion={suggestions[i]?.code ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
