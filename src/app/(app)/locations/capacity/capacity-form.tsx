"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { setCapacityAction } from "../actions";

const selectCls = "h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-sm pointer-coarse:h-11";

/** Zone + rows + columns + levels -> capacity in boxes for every matching tile. */
export function CapacityForm({ zones }: { zones: string[] }) {
  const t = useTranslations("ops.capacity");
  const tf = useTranslations("ops.tileForm");
  const { run, pending, error } = useSubmit();
  const [v, setV] = useState({
    zone: zones[0] ?? "",
    rows: "A-F",
    columnFrom: "1",
    columnTo: "99",
    levelFrom: "1",
    levelTo: "1",
    capacity: "",
  });
  const num = (k: keyof typeof v, label: string, max = 99) => (
    <Field label={label} htmlFor={`cap-${k}`}>
      <Input
        id={`cap-${k}`}
        type="number"
        min={k === "capacity" ? 1 : 0}
        max={max}
        inputMode="numeric"
        value={v[k]}
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
      />
    </Field>
  );
  return (
    <Card className="max-w-2xl p-4 sm:p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            setCapacityAction,
            { ...v, rows: v.rows || undefined, capacity: v.capacity ? Number(v.capacity) : null },
            { success: (d) => t("done", { count: (d as { updated: number }).updated }) },
          );
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label={tf("zone")} htmlFor="cap-zone">
            <select
              id="cap-zone"
              value={v.zone}
              onChange={(e) => setV({ ...v, zone: e.target.value })}
              className={selectCls}
            >
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </Field>
          <Field label={tf("rows")} htmlFor="cap-rows">
            <Input
              id="cap-rows"
              value={v.rows}
              onChange={(e) => setV({ ...v, rows: e.target.value.toUpperCase() })}
              className="font-mono"
            />
          </Field>
          {num("columnFrom", tf("columnsFrom"))}
          {num("columnTo", tf("columnsTo"))}
          {num("levelFrom", tf("levelsFrom"))}
          {num("levelTo", tf("levelsTo"))}
        </div>
        <Field label={tf("capacity")} htmlFor="cap-capacity" hint={t("emptyClears")}>
          <Input
            id="cap-capacity"
            type="number"
            min={1}
            inputMode="numeric"
            value={v.capacity}
            onChange={(e) => setV({ ...v, capacity: e.target.value })}
            className="max-w-40"
          />
        </Field>
        <FormError error={error} />
        <Button type="submit" loading={pending} className="justify-self-start">
          {t("apply")}
        </Button>
      </form>
    </Card>
  );
}
