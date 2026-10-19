"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { computeVariance } from "@/lib/variance";
import { cn, fmtNumber } from "@/lib/utils";
import { approveCountAction, createCountAction, enterCountsAction } from "./actions";

export function NewCount() {
  const t = useTranslations("ops.counts");
  const router = useRouter();
  const [tiles, setTiles] = useState("");
  const { run, pending, error } = useSubmit();
  return (
    <Card className="max-w-2xl p-4 sm:p-5">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const tileCodes = tiles
            .split(/[\s,;]+/)
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);
          run(
            createCountAction,
            { tileCodes },
            {
              success: (d) =>
                t("created", {
                  number: (d as { auditNumber: string }).auditNumber,
                  lines: (d as { lines: number }).lines,
                }),
              then: (d) => router.push(`/stock-audits/${(d as { id: string }).id}`),
            },
          );
        }}
      >
        <h2 className="font-semibold">{t("new")}</h2>
        <Field label={t("tiles")} htmlFor="tiles">
          <textarea
            id="tiles"
            required
            rows={3}
            value={tiles}
            onChange={(e) => setTiles(e.target.value.toUpperCase())}
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-sm"
            placeholder="BT-A-01-1, BT-A-02-1"
          />
        </Field>
        <FormError error={error} />
        <Button type="submit" loading={pending} className="justify-self-start">
          {t("new")}
        </Button>
      </form>
    </Card>
  );
}

type Line = {
  id: string;
  tile: string;
  product: string;
  batch: string | null;
  system: number;
  counted: number | null;
  reason: string | null;
};

export function CountSheet({
  auditId,
  status,
  lines,
  can,
}: {
  auditId: string;
  status: string;
  lines: Line[];
  can: { count: boolean; approve: boolean };
}) {
  const t = useTranslations("ops.counts");
  const to = useTranslations("ops");
  const editable = can.count && (status === "OPEN" || status === "COUNTING");
  const [v, setV] = useState(() =>
    Object.fromEntries(
      lines.map((l) => [l.id, { counted: l.counted == null ? "" : String(l.counted), reason: l.reason ?? "" }]),
    ),
  );
  const { run, pending, error } = useSubmit();
  const vr = computeVariance(
    lines.map((l) => ({
      id: l.id,
      systemQuantity: l.system,
      countedQuantity: v[l.id].counted === "" ? null : Number(v[l.id].counted),
      varianceReason: v[l.id].reason,
    })),
  );
  const payload = (submit: boolean) => ({
    auditId,
    submit,
    lines: lines.map((l) => ({
      lineId: l.id,
      counted: v[l.id].counted === "" ? null : Number(v[l.id].counted),
      reason: v[l.id].reason || null,
    })),
  });

  return (
    <div className="grid gap-4">
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">{to("tile")}</th>
              <th className="px-4 py-2.5 font-medium">{to("product")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("system")}</th>
              <th className="px-4 py-2.5 font-medium">{t("counted")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("variance")}</th>
              <th className="px-4 py-2.5 font-medium">{to("reason")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const row = vr.rows[i];
              return (
                <tr key={l.id} className="border-t border-line align-top">
                  <td className="px-4 py-2 font-mono text-xs">{l.tile}</td>
                  <td className="px-4 py-2">
                    {l.product}
                    <div className="text-xs text-muted">{l.batch ?? "—"}</div>
                  </td>
                  <td className="px-4 py-2 text-right tabular">{fmtNumber(l.system)}</td>
                  <td className="px-4 py-2">
                    <Input
                      aria-label={`${t("counted")} ${l.tile} ${l.product}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      disabled={!editable}
                      value={v[l.id].counted}
                      onChange={(e) => setV({ ...v, [l.id]: { ...v[l.id], counted: e.target.value } })}
                      className="w-24"
                    />
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right font-medium tabular",
                      row.variance && (row.variance > 0 ? "text-success" : "text-danger"),
                    )}
                  >
                    {row.variance == null ? "—" : row.variance > 0 ? `+${row.variance}` : row.variance}
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      aria-label={`${to("reason")} ${l.tile}`}
                      disabled={!editable}
                      aria-invalid={row.needsReason || undefined}
                      value={v[l.id].reason}
                      onChange={(e) => setV({ ...v, [l.id]: { ...v[l.id], reason: e.target.value } })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-sm text-muted">{t("gainLoss", { gain: vr.gain, loss: vr.loss })}</p>
      <FormError error={error} />
      <div className="flex flex-wrap gap-2">
        {editable && (
          <>
            <Button
              variant="secondary"
              loading={pending}
              onClick={() => run(enterCountsAction, payload(false), { success: to("saved") })}
            >
              {t("saveDraft")}
            </Button>
            <Button
              loading={pending}
              disabled={!vr.ready}
              onClick={() => run(enterCountsAction, payload(true), { success: to("saved") })}
            >
              {t("submit")}
            </Button>
          </>
        )}
        {status === "SUBMITTED" && can.approve && (
          <>
            <Button
              loading={pending}
              onClick={() =>
                run(
                  approveCountAction,
                  { auditId, approve: true },
                  { success: (d) => t("approved", { count: (d as { adjustments: number }).adjustments }) },
                )
              }
            >
              {t("approve")}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => run(approveCountAction, { auditId, approve: false }, { success: to("saved") })}
            >
              {t("reject")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
