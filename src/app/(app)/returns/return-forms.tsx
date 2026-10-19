"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, ProductSelect, TileInput, useSubmit, type ProductOption } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { inspectReturnAction, receiveReturnAction } from "./actions";

const sel = "h-11 w-full rounded-md border border-line-strong bg-surface px-2 text-base sm:h-10 sm:text-sm";

export function ReturnForm({
  products,
  orders,
}: {
  products: ProductOption[];
  orders: { id: string; label: string; customer: string }[];
}) {
  const t = useTranslations("ops");
  const empty = { salesOrderId: "", customerName: "", productId: "", batchNo: "", quantity: "", reason: "" };
  const [v, setV] = useState(empty);
  const { run, pending, error } = useSubmit();
  return (
    <Card className="content-start p-4 sm:p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            receiveReturnAction,
            { ...v, salesOrderId: v.salesOrderId || null, batchNo: v.batchNo || null },
            {
              success: (d) => t("returns.received", { number: (d as { returnNumber: string }).returnNumber }),
              then: () => setV(empty),
            },
          );
        }}
      >
        <h2 className="font-semibold">{t("returns.new")}</h2>
        <Field label={t("so.number")} htmlFor="ret-so">
          <select
            id="ret-so"
            value={v.salesOrderId}
            onChange={(e) =>
              setV({
                ...v,
                salesOrderId: e.target.value,
                customerName: orders.find((o) => o.id === e.target.value)?.customer ?? v.customerName,
              })
            }
            className={sel}
          >
            <option value="">—</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("customer")} htmlFor="ret-customer">
          <Input
            id="ret-customer"
            required
            value={v.customerName}
            onChange={(e) => setV({ ...v, customerName: e.target.value })}
          />
        </Field>
        <Field label={t("product")} htmlFor="ret-product">
          <ProductSelect
            id="ret-product"
            products={products}
            value={v.productId}
            onChange={(id) => setV({ ...v, productId: id })}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("batch")} htmlFor="ret-batch">
            <Input
              id="ret-batch"
              value={v.batchNo}
              onChange={(e) => setV({ ...v, batchNo: e.target.value.toUpperCase() })}
              className="font-mono"
            />
          </Field>
          <Field label={t("qty")} htmlFor="ret-qty">
            <Input
              id="ret-qty"
              type="number"
              min={1}
              required
              inputMode="numeric"
              value={v.quantity}
              onChange={(e) => setV({ ...v, quantity: e.target.value })}
            />
          </Field>
        </div>
        <Field label={t("reason")} htmlFor="ret-reason">
          <Input
            id="ret-reason"
            required
            minLength={3}
            value={v.reason}
            onChange={(e) => setV({ ...v, reason: e.target.value })}
          />
        </Field>
        <FormError error={error} />
        <Button type="submit" loading={pending} className="justify-self-start">
          {t("returns.new")}
        </Button>
      </form>
    </Card>
  );
}

export function InspectReturn({ returnId }: { returnId: string }) {
  const t = useTranslations("ops");
  const [disposition, setDisposition] = useState<"RESTOCK" | "DAMAGE" | "SEND_BACK">("RESTOCK");
  const [tile, setTile] = useState("");
  const [notes, setNotes] = useState("");
  const { run, pending, error } = useSubmit();
  return (
    <form
      className="grid gap-2 rounded-md bg-surface-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          inspectReturnAction,
          { returnId, disposition, notes, restockTileCode: disposition === "RESTOCK" ? tile : undefined },
          { success: t("saved") },
        );
      }}
    >
      <fieldset className="grid gap-1">
        <legend className="mb-1 font-medium">{t("returns.disposition")}</legend>
        {(["RESTOCK", "DAMAGE", "SEND_BACK"] as const).map((d) => (
          <label key={d} className="flex min-h-10 items-center gap-2">
            <input
              type="radio"
              name={`disp-${returnId}`}
              checked={disposition === d}
              onChange={() => setDisposition(d)}
              className="size-4 accent-[var(--primary)]"
            />
            {t(`returns.${d}`)}
          </label>
        ))}
      </fieldset>
      {disposition === "RESTOCK" && (
        <TileInput
          aria-label={t("returns.restockTile")}
          required
          value={tile}
          onChange={(e) => setTile(e.target.value)}
        />
      )}
      <Input
        aria-label={t("notes")}
        placeholder={t("notes")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button type="submit" size="sm" loading={pending} className="justify-self-start">
        {t("returns.inspect")}
      </Button>
      <FormError error={error} />
    </form>
  );
}
