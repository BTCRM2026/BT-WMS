"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { ProductSelect, type ProductOption } from "./forms";

export type QtyLine = { productId: string; quantity: string };

/** Product + quantity rows, used by purchase and sales orders. */
export function QtyLines({
  lines,
  onChange,
  products,
  labels,
}: {
  lines: QtyLine[];
  onChange: (l: QtyLine[]) => void;
  products: ProductOption[];
  labels: { product: string; qty: string; add: string; remove: string };
}) {
  const set = (i: number, patch: Partial<QtyLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="grid gap-3">
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span className={i ? "sr-only" : "font-medium"}>{labels.product}</span>
            <ProductSelect
              id={`p-${i}`}
              products={products}
              value={l.productId}
              onChange={(id) => set(i, { productId: id })}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className={i ? "sr-only" : "font-medium"}>{labels.qty}</span>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              required
              value={l.quantity}
              onChange={(e) => set(i, { quantity: e.target.value })}
              className="h-11 sm:h-10"
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={labels.remove}
            disabled={lines.length === 1}
            onClick={() => onChange(lines.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...lines, { productId: "", quantity: "1" }])}
        className="justify-self-start"
      >
        <Plus /> {labels.add}
      </Button>
    </div>
  );
}
