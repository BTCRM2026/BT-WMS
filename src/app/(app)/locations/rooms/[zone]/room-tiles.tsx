"use client";

import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Card, EmptyState } from "@/components/ui/primitives";
import { roomRows } from "@/lib/rooms";
import type { TileWithStock } from "@/server/insights";
import { FillLegend, TileButton, TileSheet } from "../../tiles";

/** A room's tiles, one line per row (A, B, C ...). Tap a tile to see what is on it. */
export function RoomTiles({ tiles, canManage }: { tiles: TileWithStock[]; canManage?: boolean }) {
  const t = useTranslations("rooms");
  const tl = useTranslations("locations.types");
  const [open, setOpen] = useState<TileWithStock | null>(null);
  if (tiles.length === 0)
    return (
      <Card>
        <EmptyState icon={<LayoutGrid />} title={t("noTiles")} body={canManage ? t("noTilesBody") : undefined} />
      </Card>
    );
  const label = (x: TileWithStock) => {
    const spot = String(x.column).padStart(2, "0") + (x.level > 1 ? `·L${x.level}` : "");
    return x.type === "STORAGE" ? spot : `${tl(x.type)} ${spot}`;
  };
  return (
    <div className="space-y-4">
      <FillLegend />
      {roomRows(tiles).map(({ row, tiles: rt }) => (
        <section
          key={row}
          className="rounded-lg border border-line bg-surface p-3 shadow-sm sm:p-4"
          aria-label={t("row", { row })}
          data-testid={`row-${row}`}
        >
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-brand-soft font-mono text-sm text-brand">
              {row}
            </span>
            {t("row", { row })}
            <span className="text-sm font-normal text-muted">· {t("rowTiles", { count: rt.length })}</span>
          </h2>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {rt.map((tile) => (
              <TileButton
                key={tile.id}
                tile={tile}
                label={label(tile)}
                wide={tile.type !== "STORAGE"}
                onOpen={setOpen}
              />
            ))}
          </div>
        </section>
      ))}
      <TileSheet key={open?.id} tile={open} onClose={() => setOpen(null)} canManage={canManage} />
    </div>
  );
}
