"use client";

import { MapPin, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { FormError, ProductSelect, TileInput, useDraft, useSubmit, type ProductOption } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { receiveAction, suggestSplitsAction, uploadPhotosAction } from "../actions";

export type Part = { tileCode: string; quantity: string };
type Line = {
  productId: string;
  expected: string;
  received: string;
  damaged: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  /** Tiles to put the good units on right away (prefilled with suggestions). */
  put?: Part[];
  /** The user changed the tiles: stop replacing them with suggestions. */
  putEdited?: boolean;
};
const blank = (productId = "", expected = ""): Line => ({
  productId,
  expected,
  received: expected,
  damaged: "0",
  batchNo: "",
  mfgDate: "",
  expiryDate: "",
});
const want = (l: Line) => `${l.productId}|${Number(l.received) || 0}`;
const placed = (l: Line) => (l.put ?? []).reduce((n, x) => n + (Number(x.quantity) || 0), 0);

export function ReceiveForm({
  products,
  pos,
  initialPo,
}: {
  products: ProductOption[];
  pos: { id: string; label: string; lines: { productId: string; quantity: number }[] }[];
  initialPo: string;
}) {
  const t = useTranslations("ops");
  const router = useRouter();
  const photos = useRef<HTMLInputElement>(null);
  const [v, setV, clear] = useDraft(`receipt:${initialPo || "direct"}`, {
    poId: initialPo,
    putAwayNow: true,
    lines: [blank()] as Line[],
  });
  const putNow = v.putAwayNow ?? true;
  const { run, pending, error } = useSubmit();
  const upload = useSubmit();

  // Choosing a PO pre-fills its lines with the expected quantities.
  const pickPo = (poId: string) => {
    const po = pos.find((p) => p.id === poId);
    setV({ ...v, poId, lines: po ? po.lines.map((l) => blank(l.productId, String(l.quantity))) : [blank()] });
  };
  useEffect(() => {
    if (initialPo && v.lines.length === 1 && !v.lines[0].productId) pickPo(initialPo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPo]);

  const set = (i: number, k: keyof Line, val: string) =>
    setV({ ...v, lines: v.lines.map((l, j) => (j === i ? { ...l, [k]: val } : l)) });
  const setPut = (i: number, put: Part[]) =>
    setV({ ...v, lines: v.lines.map((l, j) => (j === i ? { ...l, put, putEdited: true } : l)) });
  const tracked = (pid: string) => products.find((p) => p.id === pid)?.expiryTracked;

  // Suggest tiles (default tile first, then the nearest with room, split by box capacity)
  // whenever a product or good quantity changes, unless the user already edited that line's tiles.
  const sig = putNow ? v.lines.map(want).join(",") : "";
  useEffect(() => {
    if (!sig) return;
    const asked = v.lines.map(want);
    const timer = setTimeout(async () => {
      const r = await suggestSplitsAction(
        v.lines.map((l) => ({ productId: l.productId, quantity: Number(l.received) || 0 })),
      ).catch(() => null);
      if (!r?.ok) return;
      setV((cur) => ({
        ...cur,
        lines: cur.lines.map((l, i) =>
          l.putEdited || want(l) !== asked[i]
            ? l
            : { ...l, put: (r.data[i] ?? []).map((x) => ({ tileCode: x.tileCode, quantity: String(x.quantity) })) },
        ),
      }));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return (
    <form
      className="grid max-w-5xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          receiveAction,
          {
            purchaseOrderId: v.poId || null,
            putAwayNow: putNow,
            lines: v.lines.map(({ put, ...l }) => ({
              ...l,
              expected: l.expected === "" ? null : l.expected,
              damaged: l.damaged || 0,
              putAway: putNow
                ? (put ?? [])
                    .filter((x) => x.tileCode && Number(x.quantity) > 0)
                    .map((x) => ({ tileCode: x.tileCode, quantity: Number(x.quantity) }))
                : undefined,
            })),
          },
          {
            success: (d) => t("inward.posted", { number: (d as { receiptNumber: string }).receiptNumber }),
            then: async (d) => {
              const files = photos.current?.files;
              if (files?.length) {
                const form = new FormData();
                form.set("receiptId", (d as { id: string }).id);
                for (const f of files) form.append("photos", f);
                const r = await upload.run((fd: FormData) => uploadPhotosAction(fd), form as never, { refresh: false });
                if (!r) toast.error(t("inward.photos"));
              }
              // Everything placed: back to the receipts. Otherwise the rest waits in the putaway queue.
              const all = putNow && v.lines.every((l) => placed(l) >= (Number(l.received) || 0));
              clear();
              router.push(all ? "/inward" : "/inward/putaway");
            },
          },
        );
      }}
    >
      <Card className="p-4 sm:p-5">
        <Field label={t("inward.against")} htmlFor="po">
          <select
            id="po"
            value={v.poId}
            onChange={(e) => pickPo(e.target.value)}
            className="h-11 w-full max-w-md rounded-md border border-line-strong bg-surface px-2 text-base sm:h-10 sm:text-sm"
          >
            <option value="">{t("inward.noPo")}</option>
            {pos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <label className="mt-3 flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={putNow}
            onChange={(e) => setV({ ...v, putAwayNow: e.target.checked })}
            className="mt-0.5 size-5 accent-[var(--primary)]"
            data-testid="put-away-now"
          />
          <span>
            <span className="font-medium">{t("inward.putNow")}</span>
            <span className="block text-muted">{t("inward.putNowHint")}</span>
          </span>
        </label>
      </Card>

      {v.lines.map((l, i) => (
        <Card key={i} className="grid gap-3 p-4 sm:grid-cols-6 sm:p-5">
          <div className="sm:col-span-6 flex items-end gap-2">
            <Field label={`${t("product")} ${i + 1}`} htmlFor={`p-${i}`}>
              <ProductSelect
                id={`p-${i}`}
                products={products}
                value={l.productId}
                onChange={(id) => set(i, "productId", id)}
                required
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("remove")}
              disabled={v.lines.length === 1}
              onClick={() => setV({ ...v, lines: v.lines.filter((_, j) => j !== i) })}
            >
              <Trash2 />
            </Button>
          </div>
          {(
            [
              ["expected", t("inward.expected")],
              ["received", t("inward.received")],
              ["damaged", t("inward.damaged")],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label} htmlFor={`${k}-${i}`}>
              <Input
                id={`${k}-${i}`}
                type="number"
                min={0}
                inputMode="numeric"
                value={l[k]}
                required={k === "received"}
                onChange={(e) => set(i, k, e.target.value)}
              />
            </Field>
          ))}
          <Field label={t("batch")} htmlFor={`b-${i}`}>
            <Input
              id={`b-${i}`}
              value={l.batchNo}
              required={tracked(l.productId)}
              onChange={(e) => set(i, "batchNo", e.target.value.toUpperCase())}
              className="font-mono"
            />
          </Field>
          <Field label={t("inward.mfg")} htmlFor={`m-${i}`}>
            <Input id={`m-${i}`} type="date" value={l.mfgDate} onChange={(e) => set(i, "mfgDate", e.target.value)} />
          </Field>
          <Field label={t("inward.expiry")} htmlFor={`x-${i}`}>
            <Input
              id={`x-${i}`}
              type="date"
              value={l.expiryDate}
              required={tracked(l.productId)}
              onChange={(e) => set(i, "expiryDate", e.target.value)}
            />
          </Field>
          {putNow && l.productId && Number(l.received) > 0 && (
            <PutOnTiles i={i} parts={l.put ?? []} good={Number(l.received)} onChange={(put) => setPut(i, put)} />
          )}
        </Card>
      ))}
      <Button
        type="button"
        variant="secondary"
        className="justify-self-start"
        onClick={() => setV({ ...v, lines: [...v.lines, blank()] })}
      >
        <Plus /> {t("addLine")}
      </Button>

      <Card className="p-4 sm:p-5">
        <Field label={t("inward.photos")} htmlFor="photos" hint={t("inward.photosHint")}>
          <input
            ref={photos}
            id="photos"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="block w-full text-sm file:mr-3 file:h-10 file:rounded-md file:border-0 file:bg-primary-soft file:px-4 file:text-primary"
          />
        </Field>
      </Card>
      <FormError error={error ?? upload.error} />
      <Button type="submit" size="lg" loading={pending || upload.pending} className="justify-self-start">
        {t("inward.post")}
      </Button>
    </form>
  );
}

/** "Put on tile(s)": suggested tiles with quantities; edit, scan, add or remove a tile. */
export function PutOnTiles({
  i,
  parts,
  good,
  onChange,
}: {
  i: number | string;
  parts: Part[];
  good: number;
  onChange: (parts: Part[]) => void;
}) {
  const t = useTranslations("ops");
  const total = parts.reduce((n, x) => n + (Number(x.quantity) || 0), 0);
  const edit = (j: number, k: keyof Part, val: string) =>
    onChange(parts.map((x, n) => (n === j ? { ...x, [k]: val } : x)));
  return (
    <fieldset className="grid gap-2 rounded-md border border-line p-3 sm:col-span-6" data-testid={`put-${i}`}>
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <MapPin className="size-4 text-muted" aria-hidden /> {t("inward.putOn")}
      </legend>
      {parts.length === 0 && <p className="text-sm text-warning">{t("inward.noSuggestion")}</p>}
      {parts.map((x, j) => (
        <div key={j} className="flex items-center gap-2">
          <label htmlFor={`pt-${i}-${j}`} className="sr-only">
            {t("tile")} {j + 1}
          </label>
          <div className="min-w-0 flex-1">
            <TileInput id={`pt-${i}-${j}`} value={x.tileCode} onChange={(e) => edit(j, "tileCode", e.target.value)} />
          </div>
          <label htmlFor={`pq-${i}-${j}`} className="sr-only">
            {t("qty")} {j + 1}
          </label>
          <Input
            id={`pq-${i}-${j}`}
            type="number"
            min={1}
            inputMode="numeric"
            value={x.quantity}
            onChange={(e) => edit(j, "quantity", e.target.value)}
            className="w-24"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("remove")}
            onClick={() => onChange(parts.filter((_, n) => n !== j))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...parts, { tileCode: "", quantity: String(Math.max(0, good - total)) }])}
        >
          <Plus /> {t("inward.addTile")}
        </Button>
        <span className={total > good ? "text-danger" : "text-muted"} aria-live="polite">
          {total > good
            ? t("inward.tooMany", { placed: total, good })
            : total < good
              ? t("inward.restWaits", { placed: total, good, rest: good - total })
              : t("inward.allPlaced", { good })}
        </span>
      </div>
    </fieldset>
  );
}
