"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { reportServerTrouble } from "@/components/connection-banner";
import { Input } from "@/components/ui/primitives";
import { ScanButton } from "@/components/scan-button";
import { cn } from "@/lib/utils";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);

/**
 * Submit helper for every form: one idempotency key per attempt (so a double
 * click or a retry cannot create a second record), pending state that disables
 * the button, toast on success, inline error on failure.
 */
export function useSubmit() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newKey());

  const run = useCallback(
    <I extends object, O>(
      fn: (input: I & { key: string }) => Promise<Result<O>>,
      input: I,
      opts: { success?: string | ((d: O) => string); then?: (d: O) => void; refresh?: boolean } = {},
    ) =>
      new Promise<O | null>((resolve) =>
        start(async () => {
          setError(null);
          let r: Result<O>;
          try {
            r = await fn((input instanceof FormData ? input : { ...input, key: key.current }) as I & { key: string });
          } catch {
            // Network/server unreachable: keep the same key so the retry is still safe.
            reportServerTrouble();
            setError("Could not reach the server. Your entry is kept; try again.");
            return resolve(null);
          }
          if (!r.ok) {
            setError(r.error);
            toast.error(r.error);
            return resolve(null);
          }
          key.current = newKey(); // next submit is a new operation
          if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(r.data) : opts.success);
          opts.then?.(r.data);
          if (opts.refresh !== false) router.refresh();
          resolve(r.data);
        }),
      ),
    [router],
  );
  return { run, pending, error, setError };
}

/** Keep an in-progress form in sessionStorage so an accidental refresh loses nothing. */
export function useDraft<T>(id: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`draft:${id}`);
      if (saved) setValue(JSON.parse(saved) as T);
    } catch {}
    loaded.current = true;
  }, [id]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      sessionStorage.setItem(`draft:${id}`, JSON.stringify(value));
    } catch {}
  }, [id, value]);
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(`draft:${id}`);
    } catch {}
    setValue(initial);
  }, [id, initial]);
  return [value, setValue, clear] as const;
}

export type ProductOption = { id: string; sku: string; name: string; expiryTracked?: boolean };

export function ProductSelect({
  id,
  products,
  value,
  onChange,
  className,
  required,
}: {
  id: string;
  products: ProductOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  required?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-11 w-full rounded-md border border-line-strong bg-surface px-2 text-base sm:h-10 sm:text-sm",
        className,
      )}
    >
      <option value="">Choose a product…</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.sku} · {p.name}
        </option>
      ))}
    </select>
  );
}

/** Tile/product code field: upper-case, camera scan button, and works with USB scanners (they type + Enter). */
export function TileInput(props: React.ComponentProps<"input">) {
  const { onChange, className, ...rest } = props;
  return (
    <div className="flex min-w-0 gap-2">
      <Input
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        enterKeyHint="go"
        placeholder="BT-A-03-1"
        {...rest}
        onChange={(e) => {
          e.target.value = e.target.value.toUpperCase();
          onChange?.(e);
        }}
        className={cn("min-w-0 flex-1 font-mono uppercase", className)}
      />
      <ScanButton
        onCode={(code) => onChange?.({ target: { value: code.toUpperCase() } } as React.ChangeEvent<HTMLInputElement>)}
      />
    </div>
  );
}
export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {error}
    </p>
  );
}
