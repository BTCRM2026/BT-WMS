import { DoorOpen } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { tilesWithStock } from "@/server/insights";
import { summarizeRooms, type RoomSummary } from "@/lib/rooms";
import { cn, fmtNumber } from "@/lib/utils";
import { ViewTabs } from "../tiles";
import { RoomFormButton } from "./room-forms";

export const metadata = { title: "Rooms" };

const barCls = (fill: number | null) =>
  fill == null ? "" : fill < 0.5 ? "bg-success" : fill < 0.9 ? "bg-warning" : "bg-danger";

export default async function RoomsPage() {
  const ctx = await requirePage("locations.view");
  const t = await getTranslations("rooms");
  const [tiles, rooms] = await Promise.all([
    tilesWithStock(ctx.db),
    ctx.db.room.findMany({ select: { id: true, zone: true, name: true, note: true } }),
  ]);
  const list = summarizeRooms(rooms, tiles);
  const canManage = ctx.can("locations.manage");
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <ViewTabs />
            {canManage && <RoomFormButton companyCode={ctx.company.code} />}
          </>
        }
      />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<DoorOpen />} title={t("empty")} body={t("emptyBody")} />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="room-list">
          {list.map((r) => (
            <li key={r.zone}>
              <RoomCard room={r} t={t} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function RoomCard({ room: r, t }: { room: RoomSummary; t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <Link
      href={`/locations/rooms/${r.zone}`}
      data-testid={`room-${r.zone}`}
      className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm transition-colors duration-150 hover:border-primary/50 hover:bg-primary-soft/40"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-soft font-mono text-sm font-semibold text-brand">
          {r.zone}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.name}</p>
          {r.note && <p className="truncate text-sm text-muted">{r.note}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
        <span className="font-medium text-foreground">{t("tiles", { count: r.tiles })}</span>
        {r.tiles > 0 && <span>{t("usedFree", { used: r.used, free: r.tiles - r.used })}</span>}
        {r.full > 0 && <span className="text-danger">{t("fullTiles", { count: r.full })}</span>}
      </div>
      <div className="mt-auto space-y-1">
        <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className={cn("h-full rounded-full", barCls(r.fill))} style={{ width: `${(r.fill ?? 0) * 100}%` }} />
        </div>
        <p className="text-xs text-muted tabular">
          {r.capacity == null
            ? t("boxes", { boxes: fmtNumber(r.boxes) })
            : t("boxesOf", { boxes: fmtNumber(r.boxes), capacity: fmtNumber(r.capacity) })}
        </p>
      </div>
    </Link>
  );
}
