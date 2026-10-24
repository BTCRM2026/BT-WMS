"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { fmtNumber } from "@/lib/utils";
import { putawayAction } from "../actions";
import { PutOnTiles, type Part } from "../new/receive-form";

/**
 * One receipt line: the suggested tile(s) are filled in (split by box room when one
 * tile cannot take everything). Edit or scan, confirm. What is not placed stays here.
 * Built for one hand on a cheap phone.
 */
export function PutawayCard({
  line,
  suggestion,
  canAct,
}: {
  line: { id: string; sku: string; name: string; batch: string | null; qty: number; receipt: string };
  suggestion: { tileCode: string; quantity: number }[];
  canAct: boolean;
}) {
  const t = useTranslations("ops");
  const [parts, setParts] = useState<Part[]>(
    suggestion.map((s) => ({ tileCode: s.tileCode, quantity: String(s.quantity) })),
  );
  const { run, pending, error } = useSubmit();
  const valid = parts.filter((p) => p.tileCode && Number(p.quantity) > 0);
  return (
    <Card className="p-4" data-testid={`putaway-${line.sku}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{line.name}</p>
          <p className="text-sm text-muted">
            {line.sku} · {t("batch")} {line.batch ?? "—"} · {line.receipt}
          </p>
        </div>
        <span className="shrink-0 text-xl font-semibold tabular">{fmtNumber(line.qty)}</span>
      </div>
      {canAct ? (
        <form
          className="mt-3 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              putawayAction,
              {
                lineId: line.id,
                parts: valid.map((p) => ({ tileCode: p.tileCode, quantity: Number(p.quantity) })),
              },
              {
                success: (d) =>
                  t("inward.putawayDone", {
                    qty: (d as { quantity: number }).quantity,
                    tile: (d as { tileCode: string }).tileCode,
                  }),
              },
            );
          }}
        >
          <PutOnTiles i={line.id} parts={parts} good={line.qty} onChange={setParts} />
          <Button type="submit" size="lg" loading={pending} disabled={!valid.length} className="justify-self-start">
            {t("confirm")}
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted">
          {t("inward.suggested")}:{" "}
          {suggestion.length ? (
            <span className="font-mono">{suggestion.map((s) => `${s.tileCode} × ${s.quantity}`).join(", ")}</span>
          ) : (
            <span className="text-warning">{t("inward.noSuggestion")}</span>
          )}
        </p>
      )}
      <div className="mt-2">
        <FormError error={error} />
      </div>
    </Card>
  );
}
