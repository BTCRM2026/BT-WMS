"use client";

import { useTranslations } from "next-intl";
import { DataTable, type Column, type Filter } from "@/components/data-table";
import { Badge } from "@/components/ui/primitives";
import { fmtDate, fmtNumber } from "@/lib/utils";

type Row = {
  id: string;
  tile: string;
  sku: string;
  product: string;
  batch: string | null;
  expiry: string | null;
  qty: number;
};
const DAY = 86_400_000;
const TONE = { ok: "success", soon: "warning", expired: "danger", none: "neutral" } as const;

export function StockTable({ rows, now }: { rows: Row[]; now: number }) {
  const t = useTranslations("stock");
  const status = (r: Row) =>
    !r.expiry ? "none" : Date.parse(r.expiry) < now ? "expired" : Date.parse(r.expiry) < now + 90 * DAY ? "soon" : "ok";
  const columns: Column<Row>[] = [
    { key: "product", header: t("cols.product"), value: (r) => r.product, primary: true },
    { key: "sku", header: t("cols.sku"), value: (r) => r.sku },
    { key: "batch", header: t("cols.batch"), value: (r) => r.batch },
    {
      key: "tile",
      header: t("cols.tile"),
      value: (r) => r.tile,
      cell: (r) => <span className="font-mono text-xs">{r.tile}</span>,
    },
    { key: "expiry", header: t("cols.expiry"), value: (r) => r.expiry, cell: (r) => fmtDate(r.expiry) },
    {
      key: "status",
      header: t("cols.status"),
      value: (r) => t(`expiry.${status(r)}`),
      cell: (r) => <Badge tone={TONE[status(r)]}>{t(`expiry.${status(r)}`)}</Badge>,
    },
    { key: "qty", header: t("cols.qty"), value: (r) => r.qty, cell: (r) => fmtNumber(r.qty), align: "right" },
  ];
  const filters: Filter<Row>[] = [
    {
      key: "status",
      label: t("cols.status"),
      options: (["ok", "soon", "expired", "none"] as const).map((s) => ({ value: s, label: t(`expiry.${s}`) })),
      match: (r, v) => status(r) === v,
    },
  ];
  return (
    <DataTable
      id="stock"
      rows={rows}
      columns={columns}
      filters={filters}
      searchPlaceholder={t("searchPlaceholder")}
      emptyText={t("empty")}
      exportName="stock"
    />
  );
}
