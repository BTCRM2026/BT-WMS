"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  /** Plain value used for sorting, searching and CSV export. */
  value: (row: T) => string | number | null | undefined;
  /** Optional rich cell; defaults to value. */
  cell?: (row: T) => React.ReactNode;
  align?: "right";
  defaultHidden?: boolean;
  /** Shown as the card title on phones. */
  primary?: boolean;
};

export type Filter<T> = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
};

type View = { q: string; filters: Record<string, string>; sort: [string, "asc" | "desc"] | null; hidden: string[] };

const PAGE = 25;

function load<V>(key: string, fallback: V): V {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as V) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

function toCsv<T>(rows: T[], cols: Column<T>[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Quote, and neutralise spreadsheet formulas (CSV injection).
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return (
    "﻿" +
    [cols.map((c) => esc(c.header)).join(","), ...rows.map((r) => cols.map((c) => esc(c.value(r))).join(","))].join(
      "\r\n",
    )
  );
}

export function DataTable<T extends { id: string }>({
  id,
  rows,
  columns,
  filters = [],
  searchPlaceholder,
  emptyText,
  onRowClick,
  exportName,
}: {
  id: string;
  rows: T[];
  columns: Column<T>[];
  filters?: Filter<T>[];
  searchPlaceholder: string;
  emptyText: string;
  onRowClick?: (row: T) => void;
  exportName: string;
}) {
  const t = useTranslations("common");
  const defaults: View = {
    q: "",
    filters: {},
    sort: null,
    hidden: columns.filter((c) => c.defaultHidden).map((c) => c.key),
  };
  const [view, setView] = useState<View>(defaults);
  const [saved, setSaved] = useState<Record<string, View>>({});
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // Restore the last view and saved views (per table, per browser).
  useEffect(() => {
    // Only adopt ?q= from the URL; never wipe what the user already typed before hydration finished.
    // Keep anything typed before hydration finished, else adopt ?q= from the URL.
    const q = searchRef.current?.value || new URLSearchParams(window.location.search).get("q");
    setView((v) => ({ ...v, ...(q ? { q } : {}), hidden: load(`table:${id}:hidden`, v.hidden) }));
    setSaved(load(`table:${id}:views`, {}));
  }, [id]);

  const update = (patch: Partial<View>) => {
    setView((v) => {
      const next = { ...v, ...patch };
      if (patch.hidden) store(`table:${id}:hidden`, next.hidden);
      return next;
    });
    setPage(0);
  };

  const visible = columns.filter((c) => !view.hidden.includes(c.key));

  const filtered = useMemo(() => {
    const q = view.q.trim().toLowerCase();
    let out = rows.filter(
      (r) =>
        (!q ||
          columns.some((c) =>
            String(c.value(r) ?? "")
              .toLowerCase()
              .includes(q),
          )) &&
        filters.every((f) => !view.filters[f.key] || f.match(r, view.filters[f.key])),
    );
    if (view.sort) {
      const [key, dir] = view.sort;
      const col = columns.find((c) => c.key === key);
      if (col) {
        out = [...out].sort((a, b) => {
          const x = col.value(a) ?? "";
          const y = col.value(b) ?? "";
          const cmp =
            typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x).localeCompare(String(y), undefined, { numeric: true });
          return dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, columns, filters, view]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const active = view.q || Object.values(view.filters).some(Boolean);

  const sortBy = (key: string) => {
    const s = view.sort;
    update({ sort: s?.[0] !== key ? [key, "asc"] : s[1] === "asc" ? [key, "desc"] : null });
  };

  const download = () => {
    const blob = new Blob([toCsv(filtered, visible)], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `${exportName}-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveView = () => {
    const name = window.prompt(t("viewName"))?.trim();
    if (!name) return;
    const next = { ...saved, [name]: view };
    setSaved(next);
    store(`table:${id}:views`, next);
  };
  const deleteView = (name: string) => {
    const next = { ...saved };
    delete next[name];
    setSaved(next);
    store(`table:${id}:views`, next);
  };

  return (
    <div className="rounded-lg border border-line bg-surface shadow-sm" data-testid={`table-${id}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={view.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-base sm:text-sm pointer-coarse:h-11"
          />
        </div>
        {filters.map((f) => (
          <select
            key={f.key}
            aria-label={f.label}
            value={view.filters[f.key] ?? ""}
            onChange={(e) => update({ filters: { ...view.filters, [f.key]: e.target.value } })}
            className="h-10 rounded-md border border-line-strong bg-surface px-2 text-sm pointer-coarse:h-11"
          >
            <option value="">
              {f.label}: {t("all")}
            </option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        {active && (
          <Button variant="ghost" size="sm" onClick={() => update({ q: "", filters: {} })}>
            <X /> {t("clearFilters")}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label={t("savedViews")}>
                <Bookmark />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>{t("savedViews")}</MenuLabel>
              {Object.keys(saved).length === 0 && <p className="px-2 py-2 text-sm text-muted">{t("noViews")}</p>}
              {Object.entries(saved).map(([name, v]) => (
                <div key={name} className="flex items-center">
                  <MenuItem className="flex-1" onSelect={() => update(v)}>
                    {name}
                  </MenuItem>
                  <button
                    aria-label={`${t("deleteView")} ${name}`}
                    onClick={() => deleteView(name)}
                    className="grid size-9 place-items-center rounded text-muted hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <MenuSeparator />
              <MenuItem onSelect={saveView}>{t("saveView")}</MenuItem>
            </MenuContent>
          </Menu>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label={t("columns")} className="hidden md:inline-flex">
                <Columns3 />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>{t("columns")}</MenuLabel>
              {columns.map((c) => (
                <MenuCheckboxItem
                  key={c.key}
                  checked={!view.hidden.includes(c.key)}
                  disabled={c.primary}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) =>
                    update({ hidden: on ? view.hidden.filter((k) => k !== c.key) : [...view.hidden, c.key] })
                  }
                >
                  {c.header}
                </MenuCheckboxItem>
              ))}
            </MenuContent>
          </Menu>
          <Button variant="secondary" size="icon" onClick={download} aria-label={t("exportCsv")} title={t("exportCsv")}>
            <Download />
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title={emptyText}
          action={
            active && (
              <Button variant="secondary" onClick={() => update({ q: "", filters: {} })}>
                {t("clearFilters")}
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="divide-y divide-line md:hidden">
            {shown.map((r) => {
              const primary = visible.find((c) => c.primary) ?? visible[0];
              return (
                <li key={r.id} className="relative">
                  {/* The whole card is clickable through the title button's overlay; controls inside
                      the card (e.g. a checkbox) sit above it, so no control is nested in another. */}
                  <div className={cn("block px-4 py-3", onRowClick && "has-[>button:active]:bg-surface-2")}>
                    {onRowClick ? (
                      <button
                        type="button"
                        onClick={() => onRowClick(r)}
                        className="block w-full text-left font-medium after:absolute after:inset-0"
                      >
                        {primary.cell ? primary.cell(r) : primary.value(r)}
                      </button>
                    ) : (
                      <div className="font-medium">{primary.cell ? primary.cell(r) : primary.value(r)}</div>
                    )}
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {visible
                        .filter((c) => c !== primary)
                        .map((c) => (
                          <div key={c.key} className="flex min-w-0 flex-col">
                            <dt className="text-xs text-muted">{c.header}</dt>
                            <dd className="truncate">{c.cell ? c.cell(r) : (c.value(r) ?? "—")}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Tablet and up: table with sticky header */}
          <div className="hidden max-h-[70vh] overflow-auto md:block">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {visible.map((c) => {
                    const dir = view.sort?.[0] === c.key ? view.sort[1] : null;
                    const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                        className={cn(
                          "sticky top-0 z-10 border-b border-line bg-surface-2 px-4 py-2.5 text-left font-medium text-muted",
                          c.align === "right" && "text-right",
                        )}
                      >
                        <button
                          onClick={() => sortBy(c.key)}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-foreground",
                            c.align === "right" && "flex-row-reverse",
                          )}
                          aria-label={t("sortBy", { column: c.header })}
                        >
                          {c.header}
                          <Icon className={cn("size-3.5", !dir && "opacity-40")} aria-hidden />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={r.id}
                    onClick={onRowClick && (() => onRowClick(r))}
                    className={cn("transition-colors duration-150 hover:bg-surface-2", onRowClick && "cursor-pointer")}
                  >
                    {visible.map((c, i) => (
                      <td
                        key={c.key}
                        className={cn(
                          "border-b border-line px-4 py-2.5",
                          c.align === "right" && "text-right tabular",
                          i === 0 && "font-medium",
                        )}
                      >
                        {i === 0 && onRowClick ? (
                          <button
                            className="text-left hover:underline"
                            onClick={(e) => (e.stopPropagation(), onRowClick(r))}
                          >
                            {c.cell ? c.cell(r) : c.value(r)}
                          </button>
                        ) : c.cell ? (
                          c.cell(r)
                        ) : (
                          (c.value(r) ?? "—")
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-sm text-muted">
        <span className="tabular" aria-live="polite">
          {filtered.length === 0
            ? "0"
            : t("rowsOf", { from: current * PAGE + 1, to: current * PAGE + shown.length, total: filtered.length })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            aria-label={t("previous")}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            aria-label={t("next")}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
