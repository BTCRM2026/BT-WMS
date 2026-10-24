import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { tilesWithStock } from "@/server/insights";
import { nextRow, summarizeRooms } from "@/lib/rooms";
import { fmtNumber } from "@/lib/utils";
import { AddRowButton, RoomFormButton } from "../room-forms";
import { RoomTiles } from "./room-tiles";

export async function generateMetadata({ params }: { params: Promise<{ zone: string }> }) {
  return { title: `Room ${(await params).zone.toUpperCase()}` };
}

export default async function RoomPage({ params }: { params: Promise<{ zone: string }> }) {
  const zone = (await params).zone.toUpperCase();
  if (!/^[A-Z0-9]{2,4}$/.test(zone)) notFound();
  const ctx = await requirePage("locations.view");
  const t = await getTranslations("rooms");
  // Both reads are company-scoped: another company's room is simply not found.
  const [all, room] = await Promise.all([
    tilesWithStock(ctx.db),
    ctx.db.room.findFirst({ where: { zone }, select: { id: true, zone: true, name: true, note: true } }),
  ]);
  const tiles = all.filter((x) => x.zone === zone);
  if (!room && tiles.length === 0) notFound();
  const [summary] = summarizeRooms(room ? [room] : [], tiles);
  const canManage = ctx.can("locations.manage");
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/locations/rooms" className={buttonVariants({ variant: "secondary" })} data-testid="leave-room">
          <ArrowLeft /> {t("leave")}
        </Link>
        <nav aria-label={t("breadcrumb")} className="flex min-w-0 items-center gap-1 text-sm text-muted">
          <Link href="/locations/rooms" className="hover:text-foreground">
            {t("breadcrumb")}
          </Link>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
          <span className="truncate font-medium text-foreground" aria-current="page">
            {summary.name}
          </span>
        </nav>
      </div>
      <PageHeader
        title={summary.name}
        subtitle={[summary.note, summary.zone].filter(Boolean).join(" · ")}
        actions={
          canManage && (
            <>
              <RoomFormButton companyCode={ctx.company.code} room={summary} />
              <AddRowButton zone={zone} nextRow={nextRow(tiles)} />
            </>
          )
        }
      />
      <p className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted" data-testid="room-stats">
        <span className="font-medium text-foreground">{t("tiles", { count: summary.tiles })}</span>
        {summary.tiles > 0 && <span>{t("usedFree", { used: summary.used, free: summary.tiles - summary.used })}</span>}
        {summary.full > 0 && <span className="text-danger">{t("fullTiles", { count: summary.full })}</span>}
        <span>
          {summary.capacity == null
            ? t("boxes", { boxes: fmtNumber(summary.boxes) })
            : t("boxesOf", { boxes: fmtNumber(summary.boxes), capacity: fmtNumber(summary.capacity) })}
        </span>
      </p>
      <RoomTiles tiles={tiles} canManage={canManage} />
    </>
  );
}
