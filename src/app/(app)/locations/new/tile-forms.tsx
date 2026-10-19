"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, TileInput, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { expandRows, formatTileCode } from "@/lib/tile";
import { generateTilesAction, saveTileAction } from "../actions";

const TYPES = ["STORAGE", "RECEIVING", "DISPATCH", "DAMAGED", "QUARANTINE", "RETURN"] as const;
type TileType = (typeof TYPES)[number];
const selectCls = "h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-sm pointer-coarse:h-11";

export function TileForms({ companyCode }: { companyCode: string }) {
  const t = useTranslations("ops.tileForm");
  const tl = useTranslations("locations.types");
  const to = useTranslations("ops");
  const one = useSubmit();
  const bulk = useSubmit();
  const [single, setSingle] = useState({ code: "", type: "STORAGE" as TileType, capacity: "200" });
  const [g, setG] = useState({
    zone: companyCode,
    rows: "A-F",
    columnFrom: "1",
    columnTo: "20",
    levelFrom: "1",
    levelTo: "3",
    type: "STORAGE" as TileType,
    capacity: "200",
  });

  let preview = "";
  try {
    const rows = expandRows(g.rows);
    const cols = Number(g.columnTo) - Number(g.columnFrom) + 1;
    const lv = Number(g.levelTo) - Number(g.levelFrom) + 1;
    const n = rows.length * cols * lv;
    if (n > 0)
      preview = t("willCreate", {
        count: n,
        first: formatTileCode({ zone: g.zone, row: rows[0], column: Number(g.columnFrom), level: Number(g.levelFrom) }),
        last: formatTileCode({ zone: g.zone, row: rows.at(-1)!, column: Number(g.columnTo), level: Number(g.levelTo) }),
      });
  } catch {}

  const typeSelect = (value: TileType, onChange: (v: TileType) => void, id: string) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as TileType)} className={selectCls}>
      {TYPES.map((x) => (
        <option key={x} value={x}>
          {tl(x)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      <Card className="p-4 sm:p-5">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            one.run(
              saveTileAction,
              { data: { ...single, capacity: single.capacity || null } },
              { success: to("saved"), then: () => setSingle({ ...single, code: "" }) },
            );
          }}
        >
          <h2 className="font-semibold">{t("newTitle")}</h2>
          <Field
            label={t("code")}
            htmlFor="code"
            hint={t("codeHint", { example: `${companyCode}-A-03-1`, company: companyCode })}
          >
            <TileInput
              id="code"
              value={single.code}
              required
              onChange={(e) => setSingle({ ...single, code: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("type")} htmlFor="type">
              {typeSelect(single.type, (v) => setSingle({ ...single, type: v }), "type")}
            </Field>
            <Field label={t("capacity")} htmlFor="capacity">
              <Input
                id="capacity"
                type="number"
                min={1}
                value={single.capacity}
                onChange={(e) => setSingle({ ...single, capacity: e.target.value })}
              />
            </Field>
          </div>
          <FormError error={one.error} />
          <Button type="submit" loading={one.pending} className="justify-self-start">
            {to("create")}
          </Button>
        </form>
      </Card>

      <Card className="p-4 sm:p-5">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            bulk.run(
              generateTilesAction,
              { ...g, capacity: g.capacity || null },
              { success: (d) => t("created", d as { created: number; skipped: number }) },
            );
          }}
        >
          <h2 className="font-semibold">{t("generateTitle")}</h2>
          <p className="text-sm text-muted">{t("generateHint")}</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("zone")} htmlFor="zone">
              <Input
                id="zone"
                value={g.zone}
                onChange={(e) => setG({ ...g, zone: e.target.value.toUpperCase() })}
                className="font-mono"
              />
            </Field>
            <Field label={t("rows")} htmlFor="rows">
              <Input
                id="rows"
                value={g.rows}
                onChange={(e) => setG({ ...g, rows: e.target.value.toUpperCase() })}
                className="font-mono"
              />
            </Field>
            <Field label={t("columnsFrom")} htmlFor="cf">
              <Input
                id="cf"
                type="number"
                min={1}
                max={99}
                value={g.columnFrom}
                onChange={(e) => setG({ ...g, columnFrom: e.target.value })}
              />
            </Field>
            <Field label={t("columnsTo")} htmlFor="ct">
              <Input
                id="ct"
                type="number"
                min={1}
                max={99}
                value={g.columnTo}
                onChange={(e) => setG({ ...g, columnTo: e.target.value })}
              />
            </Field>
            <Field label={t("levelsFrom")} htmlFor="lf">
              <Input
                id="lf"
                type="number"
                min={1}
                max={99}
                value={g.levelFrom}
                onChange={(e) => setG({ ...g, levelFrom: e.target.value })}
              />
            </Field>
            <Field label={t("levelsTo")} htmlFor="lt">
              <Input
                id="lt"
                type="number"
                min={1}
                max={99}
                value={g.levelTo}
                onChange={(e) => setG({ ...g, levelTo: e.target.value })}
              />
            </Field>
            <Field label={t("type")} htmlFor="gtype">
              {typeSelect(g.type, (v) => setG({ ...g, type: v }), "gtype")}
            </Field>
            <Field label={t("capacity")} htmlFor="gcap">
              <Input
                id="gcap"
                type="number"
                min={1}
                value={g.capacity}
                onChange={(e) => setG({ ...g, capacity: e.target.value })}
              />
            </Field>
          </div>
          {preview && (
            <p className="text-sm text-muted" aria-live="polite">
              {preview}
            </p>
          )}
          <FormError error={bulk.error} />
          <Button type="submit" loading={bulk.pending} className="justify-self-start">
            {t("generate")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
