"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import type { LotOption } from "@/server/ops/queries";
import { decideWriteOffAction, reportWriteOffAction } from "./actions";

const sel = "h-11 w-full rounded-md border border-line-strong bg-surface px-2 text-base sm:h-10 sm:text-sm";

export function WriteOffForm({ lots }: { lots: LotOption[] }) {
  const t = useTranslations("ops");
  const [kind, setKind] = useState<"DAMAGE" | "EXPIRY">("DAMAGE");
  const [lotKey, setLotKey] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const { run, pending, error } = useSubmit();
  const lot = lots.find((l) => l.key === lotKey);
  return (
    <Card className="content-start p-4 sm:p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!lot) return;
          run(
            reportWriteOffAction,
            { kind, productId: lot.productId, batchId: lot.batchId, tileCode: lot.tileCode, quantity: qty, reason },
            {
              success: (d) => t("damages.reported", { number: (d as { damageNumber: string }).damageNumber }),
              then: () => {
                setLotKey("");
                setQty("");
                setReason("");
              },
            },
          );
        }}
      >
        <h2 className="font-semibold">{t("damages.new")}</h2>
        <Field label={t("damages.kind")} htmlFor="kind">
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "DAMAGE" | "EXPIRY")}
            className={sel}
          >
            <option value="DAMAGE">{t("damages.DAMAGE")}</option>
            <option value="EXPIRY">{t("damages.EXPIRY")}</option>
          </select>
        </Field>
        <Field label={`${t("tile")} · ${t("product")} · ${t("batch")}`} htmlFor="wo-lot">
          <select id="wo-lot" required value={lotKey} onChange={(e) => setLotKey(e.target.value)} className={sel}>
            <option value="">—</option>
            {lots.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("qty")} htmlFor="wo-qty">
          <Input
            id="wo-qty"
            type="number"
            min={1}
            max={lot?.quantity}
            required
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>
        <Field label={t("reason")} htmlFor="wo-reason">
          <Input id="wo-reason" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <FormError error={error} />
        <Button type="submit" loading={pending} className="justify-self-start">
          {t("damages.new")}
        </Button>
      </form>
    </Card>
  );
}

export function DecideWriteOff({ id }: { id: string }) {
  const t = useTranslations("ops");
  const { run, pending, error } = useSubmit();
  return (
    <>
      <Button
        size="sm"
        loading={pending}
        onClick={() => run(decideWriteOffAction, { id, approve: true }, { success: t("approve") })}
      >
        {t("approve")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(decideWriteOffAction, { id, approve: false }, { success: t("reject") })}
      >
        {t("reject")}
      </Button>
      <FormError error={error} />
    </>
  );
}
