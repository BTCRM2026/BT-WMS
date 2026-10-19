"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { FormError, ProductSelect, useDraft, useSubmit, type ProductOption } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { receiveAction, uploadPhotosAction } from "../actions";

type Line = {
  productId: string;
  expected: string;
  received: string;
  damaged: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
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
    lines: [blank()] as Line[],
  });
  const { run, pending, error } = useSubmit();
  const upload = useSubmit();

  // Choosing a PO pre-fills its lines with the expected quantities.
  const pickPo = (poId: string) => {
    const po = pos.find((p) => p.id === poId);
    setV({ poId, lines: po ? po.lines.map((l) => blank(l.productId, String(l.quantity))) : [blank()] });
  };
  useEffect(() => {
    if (initialPo && v.lines.length === 1 && !v.lines[0].productId) pickPo(initialPo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPo]);

  const set = (i: number, k: keyof Line, val: string) =>
    setV({ ...v, lines: v.lines.map((l, j) => (j === i ? { ...l, [k]: val } : l)) });
  const tracked = (pid: string) => products.find((p) => p.id === pid)?.expiryTracked;

  return (
    <form
      className="grid max-w-5xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          receiveAction,
          {
            purchaseOrderId: v.poId || null,
            lines: v.lines.map((l) => ({
              ...l,
              expected: l.expected === "" ? null : l.expected,
              damaged: l.damaged || 0,
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
              clear();
              router.push("/inward/putaway");
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
