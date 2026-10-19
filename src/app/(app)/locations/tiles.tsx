"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DataTable, type Column, type Filter } from "@/components/data-table";
import { Sheet, SheetContent } from "@/components/ui/menu";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { cn, fmtDate, fmtNumber } from "@/lib/utils";
import { rowLetter } from "@/lib/tile";
import { FormError, useSubmit } from "@/components/forms";
import { Button, buttonVariants } from "@/components/ui/button";
import { setTileActiveAction } from "./actions";
import type { TileWithStock } from "@/server/insights";

const TYPES = ["STORAGE", "RECEIVING", "DISPATCH", "DAMAGED", "QUARANTINE", "RETURN"] as const;

export const fillLevel = (t: TileWithStock) =>
  t.units === 0 ? "empty" : t.fill == null || t.fill < 0.5 ? "low" : t.fill < 0.9 ? "mid" : "full";
const FILL_CLS = {
  empty: "bg-surface border-line text-muted",
  low: "bg-success-soft border-success/40 text-success",
  mid: "bg-warning-soft border-warning/50 text-warning",
  full: "bg-danger-soft border-danger/50 text-danger",
} as const;

export function ViewTabs() {
  const t = useTranslations("locations");
  const path = usePathname();
  const tabs = [
    { href: "/locations", label: t("viewTable") },
    { href: "/locations/map", label: t("viewMap") },
  ];
  return (
    <nav aria-label={t("title")} className="inline-flex rounded-md border border-line bg-surface p-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={path === tab.href ? "page" : undefined}
          className={cn(
            "rounded px-3 py-1.5 text-sm text-muted pointer-coarse:py-2.5",
            path === tab.href && "bg-primary-soft font-medium text-primary",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function TileSheet({
  tile,
  onClose,
  canManage,
}: {
  tile: TileWithStock | null;
  onClose: () => void;
  canManage?: boolean;
}) {
  const t = useTranslations("map");
  const to = useTranslations("ops");
  const { run, pending, error } = useSubmit();
  return (
    <Sheet open={!!tile} onOpenChange={(o) => !o && onClose()}>
      {tile && (
        <SheetContent
          title={t("tileStock", { code: tile.code })}
          description={t("tileSummary", { units: fmtNumber(tile.units), capacity: tile.capacity ?? "—" })}
        >
          {tile.lines.length === 0 ? (
            <EmptyState title={t("tileEmpty")} />
          ) : (
            <ul className="divide-y divide-line" data-testid="tile-lines">
              {tile.lines.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{l.product}</p>
                    <p className="text-muted">
                      {l.sku} · {t("batch")} {l.batch ?? "—"} · {t("expiry")} {fmtDate(l.expiry)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular">{fmtNumber(l.qty)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <Link href={`/stock/ledger?tile=${tile.code}`} className={buttonVariants({ variant: "secondary" })}>
              {to("ledger.open")}
            </Link>
            {canManage && (
              <Button
                variant="ghost"
                loading={pending}
                onClick={() =>
                  run(
                    setTileActiveAction,
                    { id: tile.id, isActive: !tile.isActive },
                    { success: to("saved"), then: onClose },
                  )
                }
              >
                {tile.isActive ? to("deactivate") : to("activate")}
              </Button>
            )}
          </div>
          <FormError error={error} />
        </SheetContent>
      )}
    </Sheet>
  );
}

export function LocationsTable({ tiles, canManage }: { tiles: TileWithStock[]; canManage?: boolean }) {
  const t = useTranslations("locations");
  const [open, setOpen] = useState<TileWithStock | null>(null);
  const columns: Column<TileWithStock>[] = [
    {
      key: "code",
      header: t("cols.code"),
      value: (r) => r.code,
      cell: (r) => <span className="font-mono">{r.code}</span>,
      primary: true,
    },
    { key: "zone", header: t("cols.zone"), value: (r) => r.zone },
    {
      key: "type",
      header: t("cols.type"),
      value: (r) => t(`types.${r.type}`),
      cell: (r) => <Badge tone={r.type === "STORAGE" ? "neutral" : "info"}>{t(`types.${r.type}`)}</Badge>,
    },
    { key: "units", header: t("cols.units"), value: (r) => r.units, cell: (r) => fmtNumber(r.units), align: "right" },
    { key: "capacity", header: t("cols.capacity"), value: (r) => r.capacity, align: "right" },
    {
      key: "fill",
      header: t("cols.fill"),
      value: (r) => (r.fill == null ? null : Math.round(r.fill * 100)),
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div
              className={cn(
                "h-full rounded-full",
                { empty: "", low: "bg-success", mid: "bg-warning", full: "bg-danger" }[fillLevel(r)],
              )}
              style={{ width: `${(r.fill ?? 0) * 100}%` }}
            />
          </div>
          <span className="tabular">{r.fill == null ? "—" : `${Math.round(r.fill * 100)}%`}</span>
        </div>
      ),
    },
    { key: "active", header: t("cols.active"), value: (r) => (r.isActive ? "Yes" : "No"), defaultHidden: true },
  ];
  const zones = [...new Set(tiles.map((x) => x.zone))];
  const filters: Filter<TileWithStock>[] = [
    {
      key: "type",
      label: t("cols.type"),
      options: TYPES.map((v) => ({ value: v, label: t(`types.${v}`) })),
      match: (r, v) => r.type === v,
    },
    {
      key: "zone",
      label: t("cols.zone"),
      options: zones.map((z) => ({ value: z, label: z })),
      match: (r, v) => r.zone === v,
    },
  ];
  return (
    <>
      <DataTable
        id="locations"
        rows={tiles}
        columns={columns}
        filters={filters}
        searchPlaceholder={t("searchPlaceholder")}
        emptyText={t("empty")}
        onRowClick={setOpen}
        exportName="tiles"
      />
      <TileSheet tile={open} onClose={() => setOpen(null)} canManage={canManage} />
    </>
  );
}

export function FloorMap({ tiles, canManage }: { tiles: TileWithStock[]; canManage?: boolean }) {
  const t = useTranslations("map");
  const tl = useTranslations("locations");
  const [open, setOpen] = useState<TileWithStock | null>(null);
  const storage = tiles.filter((x) => x.type === "STORAGE");
  const special = tiles.filter((x) => x.type !== "STORAGE");
  const levels = [...new Set(storage.map((x) => x.level))].sort((a, b) => a - b);
  const [level, setLevel] = useState(levels[0] ?? 1);
  const onLevel = storage.filter((x) => x.level === level);
  const zones = [...new Set(onLevel.map((x) => x.zone))];

  const Tile = ({ tile, wide }: { tile: TileWithStock; wide?: boolean }) => {
    const level = fillLevel(tile);
    return (
      <button
        onClick={() => setOpen(tile)}
        data-testid={`tile-${tile.code}`}
        className={cn(
          "relative flex min-h-14 min-w-12 flex-col items-start justify-between rounded-md border p-1.5 text-left transition-transform duration-150 hover:-translate-y-px hover:shadow-sm sm:min-h-16 sm:p-2",
          FILL_CLS[level],
          wide && "min-w-36",
          !tile.isActive && "opacity-50",
        )}
      >
        <span className="sr-only">{`${tile.code}: ${fmtNumber(tile.units)} / ${tile.capacity ?? "—"} (${t(level)})`}</span>
        <span aria-hidden className="font-mono text-[10px] leading-none font-medium text-foreground sm:text-[11px]">
          {wide ? tile.code : `${rowLetter(tile.row)}-${String(tile.column).padStart(2, "0")}`}
        </span>
        <span aria-hidden className="text-xs font-semibold tabular sm:text-sm">
          {tile.fill == null ? fmtNumber(tile.units) : `${Math.round(tile.fill * 100)}%`}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-label={t("legend")}>
        <span className="font-medium">{t("legend")}:</span>
        {(["empty", "low", "mid", "full"] as const).map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className={cn("size-4 rounded border", FILL_CLS[l])} aria-hidden />
            {t(l)}
          </span>
        ))}
      </div>

      {levels.length > 1 && (
        <div
          className="inline-flex flex-wrap gap-1 rounded-md border border-line bg-surface p-0.5"
          role="group"
          aria-label={t("level")}
        >
          {levels.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              aria-pressed={l === level}
              className={cn(
                "min-h-9 rounded px-3 text-sm text-muted pointer-coarse:min-h-11",
                l === level && "bg-primary-soft font-medium text-primary",
              )}
            >
              {t("levelN", { level: l })}
            </button>
          ))}
        </div>
      )}

      {zones.map((zone) => {
        const zt = onLevel.filter((x) => x.zone === zone);
        const cols = Math.max(...zt.map((x) => x.column));
        return (
          <section
            key={zone}
            className="rounded-lg border border-line bg-surface p-3 shadow-sm sm:p-4"
            aria-label={t("zone", { zone })}
          >
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <span className="grid size-7 place-items-center rounded-md bg-brand-soft text-sm text-brand">{zone}</span>
              {t("zone", { zone })}
              <span className="text-sm font-normal text-muted">
                · {fmtNumber(zt.reduce((s, x) => s + x.units, 0))} {tl("cols.units").toLowerCase()}
              </span>
            </h2>
            <div className="relative overflow-x-auto pb-1">
              <div
                className="grid gap-1.5 sm:gap-2"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(3rem, 1fr))` }}
              >
                {zt.map((tile) => (
                  <div key={tile.id} style={{ gridRow: tile.row || undefined, gridColumn: tile.column }}>
                    <Tile tile={tile} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {special.length > 0 && (
        <section className="rounded-lg border border-line bg-surface p-3 shadow-sm sm:p-4">
          <h2 className="mb-3 font-semibold">{t("special")}</h2>
          <div className="flex flex-wrap gap-2">
            {special.map((tile) => (
              <div key={tile.id} className="flex flex-col gap-1">
                <span className="text-xs text-muted">{tl(`types.${tile.type}`)}</span>
                <Tile tile={tile} wide />
              </div>
            ))}
          </div>
        </section>
      )}
      <TileSheet tile={open} onClose={() => setOpen(null)} canManage={canManage} />
    </div>
  );
}
