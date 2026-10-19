"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, TileInput, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { fmtNumber } from "@/lib/utils";
import { putawayAction } from "../actions";

/** One receipt line: big targets, scan/type the tile, confirm. Built for one hand on a cheap phone. */
export function PutawayCard({
  line,
  suggestion,
  canAct,
}: {
  line: { id: string; sku: string; name: string; batch: string | null; qty: number; receipt: string };
  suggestion: string | null;
  canAct: boolean;
}) {
  const t = useTranslations("ops");
  const [tile, setTile] = useState("");
  const { run, pending, error } = useSubmit();
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
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <MapPin className="size-4 text-muted" aria-hidden />
        {t("inward.suggested")}:
        {suggestion ? (
          <button type="button" onClick={() => setTile(suggestion)} className="rounded focus-visible:outline-2">
            <Badge tone="brand" className="font-mono text-sm">
              {suggestion}
            </Badge>
          </button>
        ) : (
          <span className="text-warning">{t("inward.noSuggestion")}</span>
        )}
      </div>
      {canAct && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              putawayAction,
              { lineId: line.id, tileCode: tile },
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
          <label htmlFor={`tile-${line.id}`} className="sr-only">
            {t("pick.scanTile")}
          </label>
          <TileInput
            id={`tile-${line.id}`}
            value={tile}
            onChange={(e) => setTile(e.target.value)}
            required
            className="h-12 text-lg"
            placeholder={suggestion ?? t("pick.scanTile")}
          />
          <Button type="submit" size="lg" loading={pending}>
            {t("confirm")}
          </Button>
        </form>
      )}
      <div className="mt-2">
        <FormError error={error} />
      </div>
    </Card>
  );
}
