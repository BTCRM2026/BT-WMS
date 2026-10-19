"use client";

import { CheckCircle2, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, TileInput, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/primitives";
import { cn, fmtNumber } from "@/lib/utils";
import { confirmPickAction } from "../actions";

type Line = {
  id: string;
  tile: string;
  sku: string;
  name: string;
  batch: string | null;
  expiry: string | null;
  qty: number;
  picked: number | null;
  shortReason: string | null;
};

/** One stop on the pick route: go to tile, scan it, confirm qty (fewer = short pick with reason). */
export function PickLine({ line, index, canAct }: { line: Line; index: number; canAct: boolean }) {
  const t = useTranslations("ops.pick");
  const tc = useTranslations("ops");
  const [tile, setTile] = useState("");
  const [qty, setQty] = useState(String(line.qty));
  const [reason, setReason] = useState("");
  const { run, pending, error } = useSubmit();
  const done = line.picked != null;
  const short = Number(qty) < line.qty;

  return (
    <Card className={cn("p-4", done && "border-success/40 bg-success-soft/40")} data-testid={`pick-line-${index}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 font-semibold tabular">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-lg font-semibold">
            <MapPin className="size-5 text-brand" aria-hidden />
            <span className="sr-only">{t("goTo")}</span>
            <span className="font-mono">{line.tile}</span>
          </p>
          <p className="font-medium">{line.name}</p>
          <p className="text-sm text-muted">
            {line.sku} · {tc("batch")} {line.batch ?? "—"}
            {line.expiry && ` · ${line.expiry}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">{t("take")}</p>
          <p className="text-2xl font-semibold tabular">{fmtNumber(line.qty)}</p>
        </div>
      </div>
      {done ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 className="size-5" aria-hidden /> {t("confirmed")}: {line.picked}
          {line.shortReason && <span className="text-warning">({line.shortReason})</span>}
        </p>
      ) : (
        canAct && (
          <form
            className="mt-3 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                confirmPickAction,
                { lineId: line.id, tileCode: tile, quantity: qty, shortReason: short ? reason : undefined },
                { success: t("confirmed") },
              );
            }}
          >
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <label className="grid gap-1 text-sm">
                <span>{t("scanTile")}</span>
                <TileInput
                  value={tile}
                  onChange={(e) => setTile(e.target.value)}
                  required
                  className="h-12 text-lg"
                  placeholder={line.tile}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t("pickedQty")}</span>
                <Input
                  type="number"
                  min={0}
                  max={line.qty}
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="h-12 text-lg"
                />
              </label>
            </div>
            {short && (
              <label className="grid gap-1 text-sm">
                <span>{t("shortReason")}</span>
                <Input value={reason} required onChange={(e) => setReason(e.target.value)} />
              </label>
            )}
            <Button type="submit" size="lg" loading={pending} className="w-full">
              {t("confirmLine")}
            </Button>
            <FormError error={error} />
          </form>
        )
      )}
    </Card>
  );
}
