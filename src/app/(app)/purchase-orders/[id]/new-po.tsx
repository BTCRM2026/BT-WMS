"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormError, useDraft, useSubmit, type ProductOption } from "@/components/forms";
import { QtyLines, type QtyLine } from "@/components/line-items";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { createPoAction } from "../actions";

const EMPTY = { supplierName: "", expectedDate: "", notes: "", lines: [{ productId: "", quantity: "1" }] as QtyLine[] };

export function NewPurchaseOrder({ products }: { products: ProductOption[] }) {
  const t = useTranslations("ops");
  const router = useRouter();
  const [v, setV, clear] = useDraft("po:new", EMPTY);
  const { run, pending, error } = useSubmit();
  return (
    <Card className="max-w-3xl p-4 sm:p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(createPoAction, v, {
            success: (d) => (d as { poNumber: string }).poNumber,
            then: (d) => {
              clear();
              router.push(`/purchase-orders/${(d as { id: string }).id}`);
            },
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("supplier")} htmlFor="supplier">
            <Input
              id="supplier"
              required
              value={v.supplierName}
              onChange={(e) => setV({ ...v, supplierName: e.target.value })}
            />
          </Field>
          <Field label={t("po.expected")} htmlFor="expected">
            <Input
              id="expected"
              type="date"
              value={v.expectedDate}
              onChange={(e) => setV({ ...v, expectedDate: e.target.value })}
            />
          </Field>
        </div>
        <QtyLines
          lines={v.lines}
          onChange={(lines) => setV({ ...v, lines })}
          products={products}
          labels={{ product: t("product"), qty: t("qty"), add: t("addLine"), remove: t("remove") }}
        />
        <Field label={t("notes")} htmlFor="notes">
          <Input id="notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </Field>
        <FormError error={error} />
        <Button type="submit" loading={pending} className="justify-self-start">
          {t("create")}
        </Button>
      </form>
    </Card>
  );
}
