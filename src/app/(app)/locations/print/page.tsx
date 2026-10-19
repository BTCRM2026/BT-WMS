import { getTranslations } from "next-intl/server";
import { PrintButton } from "@/components/print-button";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";

export const metadata = { title: "Tile map" };

/** Printable tile labels / map, grouped by zone, row by row (A4, browser print). */
export default async function PrintTilesPage() {
  const ctx = await requirePage("locations.view");
  const t = await getTranslations("ops.tileForm");
  const tiles = await ctx.db.location.findMany({
    where: { isActive: true },
    orderBy: [{ zone: "asc" }, { level: "asc" }, { row: "asc" }, { column: "asc" }],
    select: { id: true, code: true, zone: true, level: true, type: true },
  });
  const groups = Object.entries(Object.groupBy(tiles, (x) => `${x.zone} · L${x.level}`));
  return (
    <div className="print:text-black">
      <PageHeader title={t("printTitle", { company: ctx.company.name })} actions={<PrintButton />} />
      {groups.map(([g, list]) => (
        <section key={g} className="mb-6 break-inside-avoid">
          <h2 className="mb-2 font-semibold">{g}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8 print:grid-cols-6">
            {list!.map((x) => (
              <div
                key={x.id}
                className="rounded-md border-2 border-foreground/70 px-2 py-3 text-center font-mono text-sm font-bold print:border-black"
              >
                {x.code}
                {x.type !== "STORAGE" && <div className="text-[10px] font-normal">{x.type}</div>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
