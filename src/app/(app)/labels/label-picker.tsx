"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";

type Kind = "product" | "batch" | "carton" | "tile";
const sel = "h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-sm pointer-coarse:h-11";

export function LabelPicker({ items }: { items: Record<Kind, { id: string; label: string }[]> }) {
  const t = useTranslations("labels");
  const [kind, setKind] = useState<Kind>("tile");
  const [layout, setLayout] = useState<"a4" | "50x25">("a4");
  const [symbology, setSymbology] = useState<"" | "qr" | "barcode">("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const list = useMemo(
    () => items[kind].filter((i) => i.label.toLowerCase().includes(q.toLowerCase())),
    [items, kind, q],
  );
  const href = `/api/labels?kind=${kind}&layout=${layout}${symbology ? `&symbology=${symbology}` : ""}&ids=${[...picked].join(",")}`;

  return (
    <div className="grid max-w-4xl gap-4">
      <Card className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
        <Field label={t("kind")} htmlFor="kind">
          <select
            id="kind"
            value={kind}
            onChange={(e) => (setKind(e.target.value as Kind), setPicked(new Set()))}
            className={sel}
          >
            {(["tile", "product", "batch", "carton"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("layout")} htmlFor="layout">
          <select
            id="layout"
            value={layout}
            onChange={(e) => setLayout(e.target.value as "a4" | "50x25")}
            className={sel}
          >
            <option value="a4">{t("a4")}</option>
            <option value="50x25">{t("roll")}</option>
          </select>
        </Field>
        <Field label={t("symbology")} htmlFor="sym">
          <select
            id="sym"
            value={symbology}
            onChange={(e) => setSymbology(e.target.value as "" | "qr" | "barcode")}
            className={sel}
          >
            <option value="">{t("auto")}</option>
            <option value="qr">QR</option>
            <option value="barcode">Code 128</option>
          </select>
        </Field>
      </Card>
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            aria-label={t("filter")}
            placeholder={t("filter")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="secondary" size="sm" onClick={() => setPicked(new Set(list.map((i) => i.id)))}>
            {t("all", { count: list.length })}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
            {t("none")}
          </Button>
          <a
            href={href}
            target="_blank"
            rel="noopener"
            aria-disabled={!picked.size}
            className={`ml-auto inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary ${picked.size ? "hover:bg-primary-hover" : "pointer-events-none opacity-50"}`}
          >
            <Printer className="size-4" aria-hidden /> {t("print", { count: picked.size })}
          </a>
        </div>
        <ul className="grid max-h-[50vh] gap-1 overflow-y-auto sm:grid-cols-2">
          {list.map((i) => (
            <li key={i.id}>
              <label className="flex min-h-10 items-center gap-2 rounded px-2 text-sm hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={picked.has(i.id)}
                  onChange={(e) => {
                    const n = new Set(picked);
                    if (e.target.checked) n.add(i.id);
                    else n.delete(i.id);
                    setPicked(n);
                  }}
                />
                <span className="truncate font-mono text-xs">{i.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
