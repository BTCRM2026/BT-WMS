import { History } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { tilesWithStock } from "@/server/insights";
import { StockTable } from "./table";

export const metadata = { title: "Stock" };

export default async function StockPage() {
  const ctx = await requirePage("stock.view");
  const t = await getTranslations("stock");
  const to = await getTranslations("ops");
  const tiles = await tilesWithStock(ctx.db);
  const rows = tiles.flatMap((tile) => tile.lines.map((l, i) => ({ id: `${tile.id}-${i}`, tile: tile.code, ...l })));
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/stock/ledger" className={buttonVariants({ variant: "secondary" })}>
            <History /> {to("ledger.title")}
          </Link>
        }
      />
      <StockTable rows={rows} now={Date.now()} />
    </>
  );
}
