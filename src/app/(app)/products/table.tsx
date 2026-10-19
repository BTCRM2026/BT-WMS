"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DataTable, type Column, type Filter } from "@/components/data-table";
import { Badge } from "@/components/ui/primitives";
import { fmtNumber } from "@/lib/utils";

type Row = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  packSize: number;
  barcode: string | null;
  minStock: number;
  mrp: number;
  location: string | null;
  stock: number;
};

const statusOf = (r: Row) => (r.stock <= 0 ? "out" : r.stock < r.minStock ? "low" : "ok");
const TONE = { ok: "success", low: "warning", out: "danger" } as const;

export function ProductsTable({ rows }: { rows: Row[] }) {
  const t = useTranslations("products");
  const router = useRouter();
  const columns: Column<Row>[] = [
    { key: "sku", header: t("cols.sku"), value: (r) => r.sku },
    { key: "name", header: t("cols.name"), value: (r) => r.name, primary: true },
    { key: "stock", header: t("cols.stock"), value: (r) => r.stock, cell: (r) => fmtNumber(r.stock), align: "right" },
    { key: "minStock", header: t("cols.minStock"), value: (r) => r.minStock, align: "right" },
    {
      key: "status",
      header: t("cols.status"),
      value: (r) => t(`status.${statusOf(r)}`),
      cell: (r) => <Badge tone={TONE[statusOf(r)]}>{t(`status.${statusOf(r)}`)}</Badge>,
    },
    {
      key: "location",
      header: t("cols.location"),
      value: (r) => r.location,
      cell: (r) => <span className="font-mono text-xs">{r.location ?? "—"}</span>,
    },
    { key: "packSize", header: t("cols.packSize"), value: (r) => r.packSize, align: "right", defaultHidden: true },
    { key: "unit", header: t("cols.unit"), value: (r) => r.unit, defaultHidden: true },
    { key: "barcode", header: t("cols.barcode"), value: (r) => r.barcode, defaultHidden: true },
    { key: "mrp", header: t("cols.mrp"), value: (r) => r.mrp, cell: (r) => `₹${fmtNumber(r.mrp)}`, align: "right" },
  ];
  const filters: Filter<Row>[] = [
    {
      key: "status",
      label: t("cols.status"),
      options: (["ok", "low", "out"] as const).map((s) => ({ value: s, label: t(`status.${s}`) })),
      match: (r, v) => statusOf(r) === v,
    },
  ];
  return (
    <DataTable
      id="products"
      rows={rows}
      columns={columns}
      filters={filters}
      searchPlaceholder={t("searchPlaceholder")}
      emptyText={t("empty")}
      exportName="products"
      onRowClick={(r) => router.push(`/products/${r.id}`)}
    />
  );
}
