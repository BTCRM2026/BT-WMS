import { Boxes, FileText, Grid3x3, Package, Search } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { globalSearch } from "@/server/search";

export const metadata = { title: "Search" };

const ICONS = { products: Package, tiles: Grid3x3, batches: Boxes, orders: FileText };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requirePage("dashboard.view");
  const t = await getTranslations("search");
  const tt = await getTranslations("topbar");
  const q = (await searchParams).q ?? "";
  const results = await globalSearch(ctx, q);
  const groups = results
    ? (
        Object.entries(results) as [keyof typeof ICONS, { id: string; title: string; sub: string; href: string }[]][]
      ).filter(([, v]) => v.length)
    : [];

  return (
    <>
      <PageHeader title={t("title")} subtitle={q ? t("resultsFor", { q }) : undefined} />
      <form role="search" className="relative mb-6 max-w-xl">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          aria-label={t("title")}
          placeholder={tt("searchPlaceholder")}
          className="h-12 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-10 text-base"
        />
      </form>
      {!results ? (
        <p className="text-sm text-muted">{t("hint")}</p>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={<Search />} title={t("empty")} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map(([key, items]) => {
            const Icon = ICONS[key];
            return (
              <Card key={key} className="p-2">
                <h2 className="flex items-center gap-2 px-2 py-2 text-sm font-semibold">
                  <Icon className="size-4 text-muted" aria-hidden /> {t(`groups.${key}`)}
                </h2>
                <ul>
                  {items.map((i) => (
                    <li key={i.id}>
                      <Link
                        href={i.href}
                        className="flex min-h-11 flex-col justify-center rounded-md px-2 py-1.5 hover:bg-surface-2"
                      >
                        <span className="text-sm font-medium">{i.title}</span>
                        <span className="text-xs text-muted">{i.sub}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
