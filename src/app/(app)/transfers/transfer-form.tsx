"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, TileInput, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import type { LotOption } from "@/server/ops/queries";
import { transferAction } from "./actions";

export function TransferForm({ lots }: { lots: LotOption[] }) {
  const t = useTranslations("ops");
  const [lotKey, setLotKey] = useState("");
  const [to, setTo] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const { run, pending, error } = useSubmit();
  const lot = lots.find((l) => l.key === lotKey);
  return (
    <Card className="max-w-3xl p-4 sm:p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!lot) return;
          run(
            transferAction,
            {
              productId: lot.productId,
              batchId: lot.batchId,
              fromCode: lot.tileCode,
              toCode: to,
              quantity: qty,
              reason,
            },
            {
              success: t("transfer.moved", { qty }),
              then: () => {
                setLotKey("");
                setTo("");
                setQty("");
                setReason("");
              },
            },
          );
        }}
      >
        <Field label={`${t("transfer.from")} · ${t("product")} · ${t("batch")}`} htmlFor="lot">
          <select
            id="lot"
            required
            value={lotKey}
            onChange={(e) => setLotKey(e.target.value)}
            className="h-11 w-full rounded-md border border-line-strong bg-surface px-2 text-base sm:h-10 sm:text-sm"
          >
            <option value="">—</option>
            {lots.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr_8rem]">
          <Field label={t("transfer.from")} htmlFor="from">
            <Input id="from" readOnly value={lot?.tileCode ?? ""} className="font-mono" />
          </Field>
          <ArrowRight className="mb-3 hidden size-5 text-muted sm:block" aria-hidden />
          <Field label={t("transfer.to")} htmlFor="to">
            <TileInput id="to" required value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field
            label={t("qty")}
            htmlFor="qty"
            hint={lot ? t("transfer.onTile", { qty: lot.quantity, tile: lot.tileCode }) : undefined}
          >
            <Input
              id="qty"
              type="number"
              min={1}
              max={lot?.quantity}
              required
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t("reason")} htmlFor="reason">
          <Input id="reason" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <FormError error={error} />
        <Button type="submit" loading={pending} className="justify-self-start">
          {t("transfer.move")}
        </Button>
      </form>
    </Card>
  );
}
