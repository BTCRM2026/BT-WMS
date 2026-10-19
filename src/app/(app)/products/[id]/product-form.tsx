"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormError, useDraft, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { saveProductAction, setProductActiveAction } from "../actions";

type Values = {
  sku: string;
  name: string;
  unit: string;
  packSize: number | string;
  barcode: string;
  minStock: number | string;
  maxStock: number | string;
  expiryTracked: boolean;
  defaultTileCode: string;
  mrp: number | string;
  purchasePrice: number | string;
};

export function ProductForm({
  id,
  initial,
  tiles,
  canEdit,
  isActive,
}: {
  id?: string;
  initial: Values;
  tiles: string[];
  canEdit: boolean;
  isActive: boolean;
}) {
  const t = useTranslations("ops");
  const router = useRouter();
  const [v, setV, clearDraft] = useDraft<Values>(`product:${id ?? "new"}`, initial);
  const { run, pending, error } = useSubmit();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  const field = (k: keyof Values, label: string, props: React.ComponentProps<"input"> = {}, hint?: string) => (
    <Field label={label} htmlFor={k} hint={hint}>
      <Input id={k} name={k} value={String(v[k] ?? "")} onChange={set(k)} disabled={!canEdit} {...props} />
    </Field>
  );

  return (
    <form
      className="grid max-w-3xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          saveProductAction,
          { id, data: { ...v, maxStock: v.maxStock === "" ? null : v.maxStock } },
          {
            success: t("saved"),
            then: (d) => {
              clearDraft();
              router.push(`/products/${(d as { id: string }).id}`);
            },
          },
        );
      }}
    >
      <Card className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="font-semibold sm:col-span-2">{t("prod.groupBasic")}</h2>
        {field(
          "sku",
          t("prod.sku"),
          { required: true, autoCapitalize: "characters", className: "font-mono uppercase" },
          t("prod.skuHint"),
        )}
        {field("name", t("prod.name"), { required: true })}
        {field("barcode", t("prod.barcode"), { inputMode: "numeric" })}
        <div className="grid grid-cols-2 gap-4">
          {field("unit", t("prod.unit"))}
          {field("packSize", t("prod.packSize"), { type: "number", min: 1, inputMode: "numeric" })}
        </div>
      </Card>
      <Card className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="font-semibold sm:col-span-2">{t("prod.groupStock")}</h2>
        {field("minStock", t("prod.minStock"), { type: "number", min: 0, inputMode: "numeric" })}
        {field("maxStock", t("prod.maxStock"), { type: "number", min: 0, inputMode: "numeric" })}
        <Field label={t("prod.defaultTile")} htmlFor="defaultTileCode">
          <select
            id="defaultTileCode"
            value={v.defaultTileCode}
            onChange={set("defaultTileCode")}
            disabled={!canEdit}
            className="h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-sm pointer-coarse:h-11"
          >
            <option value="">—</option>
            {tiles.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={v.expiryTracked}
            onChange={set("expiryTracked")}
            disabled={!canEdit}
            className="size-5 accent-[var(--primary)]"
          />
          {t("prod.expiryTracked")}
        </label>
      </Card>
      <Card className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="font-semibold sm:col-span-2">{t("prod.groupPrice")}</h2>
        {field("mrp", t("prod.mrp"), { type: "number", min: 0, step: "0.01", inputMode: "decimal" })}
        {field("purchasePrice", t("prod.purchasePrice"), {
          type: "number",
          min: 0,
          step: "0.01",
          inputMode: "decimal",
        })}
      </Card>
      <FormError error={error} />
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            {t("save")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/products")}>
            {t("back")}
          </Button>
          {id && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => run(setProductActiveAction, { id, isActive: !isActive }, { success: t("saved") })}
            >
              {isActive ? t("deactivate") : t("activate")}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
