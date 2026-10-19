"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type Column, type Filter } from "@/components/data-table";
import { Badge, type Tone } from "@/components/ui/primitives";
import { fmtDate, fmtNumber } from "@/lib/utils";

/**
 * A DataTable whose columns are plain data, so server pages can describe a list
 * without writing a client component per screen.
 */
export type ListColumn = {
  key: string;
  header: string;
  kind?: "text" | "number" | "date" | "mono" | "badge";
  /** For kind "badge": value -> tone. */
  tones?: Record<string, Tone>;
  /** For kind "badge": value -> label. */
  labels?: Record<string, string>;
  align?: "right";
  primary?: boolean;
  defaultHidden?: boolean;
};
export type ListFilter = { key: string; label: string; options: { value: string; label: string }[] };
export type ListRow = { id: string; href?: string } & Record<string, string | number | null | undefined>;

export function ListTable({
  id,
  rows,
  columns,
  filters = [],
  searchPlaceholder,
  emptyText,
  exportName,
}: {
  id: string;
  rows: ListRow[];
  columns: ListColumn[];
  filters?: ListFilter[];
  searchPlaceholder: string;
  emptyText: string;
  exportName?: string;
}) {
  const router = useRouter();
  const cols: Column<ListRow>[] = columns.map((c) => ({
    key: c.key,
    header: c.header,
    primary: c.primary,
    defaultHidden: c.defaultHidden,
    align: c.align ?? (c.kind === "number" ? "right" : undefined),
    value: (r) => (c.kind === "badge" && c.labels ? (c.labels[String(r[c.key])] ?? r[c.key]) : r[c.key]),
    cell: (r) => {
      const v = r[c.key];
      if (v == null || v === "") return "—";
      if (c.kind === "number") return fmtNumber(Number(v));
      if (c.kind === "date") return fmtDate(String(v));
      if (c.kind === "mono") return <span className="font-mono text-xs">{v}</span>;
      if (c.kind === "badge")
        return <Badge tone={c.tones?.[String(v)] ?? "neutral"}>{c.labels?.[String(v)] ?? String(v)}</Badge>;
      if (c.primary && r.href)
        return (
          <Link href={r.href} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
            {v}
          </Link>
        );
      return v;
    },
  }));
  const fs: Filter<ListRow>[] = filters.map((f) => ({ ...f, match: (r, v) => String(r[f.key]) === v }));
  return (
    <DataTable
      id={id}
      rows={rows}
      columns={cols}
      filters={fs}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      exportName={exportName ?? id}
      onRowClick={rows.some((r) => r.href) ? (r) => r.href && router.push(r.href) : undefined}
    />
  );
}
