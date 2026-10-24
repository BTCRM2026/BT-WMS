"use client";

import { Pencil, Plus, Rows3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/menu";
import { Field, Input } from "@/components/ui/primitives";
import { formatTileCode } from "@/lib/tile";
import { generateTilesAction, saveRoomAction } from "../actions";

const TYPES = ["STORAGE", "RECEIVING", "DISPATCH", "DAMAGED", "QUARANTINE", "RETURN"] as const;
type TileType = (typeof TYPES)[number];
const selectCls = "h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-sm pointer-coarse:h-11";

type Room = { id: string | null; zone: string; name: string; note: string | null };

/**
 * New room (no `room`), rename a room, or give a zone that only has tiles a name
 * (`room` with id null: the code is fixed to that zone).
 */
export function RoomFormButton({ companyCode, room }: { companyCode: string; room?: Room }) {
  const t = useTranslations("rooms");
  const router = useRouter();
  const { run, pending, error } = useSubmit();
  const [open, setOpen] = useState(false);
  const blank = { zone: room?.zone ?? companyCode, name: room?.id ? room.name : "", note: room?.note ?? "" };
  const [form, setForm] = useState(blank);
  const editing = !!room?.id;
  const title = editing ? t("editRoom") : room ? t("nameRoom") : t("newRoom");
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(blank);
      }}
    >
      <Button
        variant={room ? "secondary" : "primary"}
        onClick={() => {
          setForm(blank);
          setOpen(true);
        }}
        data-testid={editing ? "edit-room" : "new-room"}
      >
        {room ? <Pencil /> : <Plus />} {title}
      </Button>
      <SheetContent title={title}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              saveRoomAction,
              { id: room?.id ?? undefined, data: form },
              {
                success: t("saved"),
                then: (d) => {
                  setOpen(false);
                  if (!room) router.push(`/locations/rooms/${(d as { zone: string }).zone}`);
                },
              },
            );
          }}
        >
          <Field label={t("code")} htmlFor="room-zone" hint={t("codeHint", { company: companyCode })}>
            <Input
              id="room-zone"
              value={form.zone}
              required
              maxLength={4}
              disabled={!!room}
              onChange={(e) => setForm({ ...form, zone: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
              className="font-mono"
            />
          </Field>
          <Field label={t("name")} htmlFor="room-name">
            <Input
              id="room-name"
              value={form.name}
              required
              maxLength={60}
              placeholder={t("namePlaceholder")}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label={t("note")} htmlFor="room-note">
            <Input
              id="room-note"
              value={form.note}
              maxLength={120}
              placeholder={t("notePlaceholder")}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </Field>
          <FormError error={error} />
          <Button type="submit" loading={pending} className="justify-self-start">
            {title}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Add one row of tiles to a room: row letter, how many tiles, boxes per tile, what it is used for. */
export function AddRowButton({ zone, nextRow }: { zone: string; nextRow: string }) {
  const t = useTranslations("rooms");
  const tl = useTranslations("locations.types");
  const to = useTranslations("ops.tileForm");
  const { run, pending, error } = useSubmit();
  const [open, setOpen] = useState(false);
  const blank = { row: nextRow, spots: "10", capacity: "", type: "STORAGE" as TileType };
  const [form, setForm] = useState(blank);
  const spots = Number(form.spots);
  const valid = /^[A-Z]{1,2}$/.test(form.row) && Number.isInteger(spots) && spots >= 1 && spots <= 99;
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(blank);
      }}
    >
      <Button
        onClick={() => {
          setForm(blank);
          setOpen(true);
        }}
        data-testid="add-row"
      >
        <Rows3 /> {t("addRow")}
      </Button>
      <SheetContent title={t("addRow")}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              generateTilesAction,
              {
                zone,
                rows: form.row,
                columnFrom: 1,
                columnTo: spots,
                levelFrom: 1,
                levelTo: 1,
                type: form.type,
                capacity: form.capacity ? Number(form.capacity) : null,
              },
              {
                success: (d) => to("created", d as { created: number; skipped: number }),
                then: () => setOpen(false),
              },
            );
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("rowLetter")} htmlFor="row-letter" hint={t("rowLetterHint")}>
              <Input
                id="row-letter"
                value={form.row}
                required
                maxLength={2}
                onChange={(e) => setForm({ ...form, row: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
                className="font-mono"
              />
            </Field>
            <Field label={t("spots")} htmlFor="row-spots">
              <Input
                id="row-spots"
                type="number"
                min={1}
                max={99}
                inputMode="numeric"
                required
                value={form.spots}
                onChange={(e) => setForm({ ...form, spots: e.target.value })}
              />
            </Field>
            <Field label={t("capacity")} htmlFor="row-capacity">
              <Input
                id="row-capacity"
                type="number"
                min={1}
                inputMode="numeric"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </Field>
            <Field label={t("type")} htmlFor="row-type">
              <select
                id="row-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TileType })}
                className={selectCls}
              >
                {TYPES.map((x) => (
                  <option key={x} value={x}>
                    {tl(x)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {valid && (
            <p className="text-sm text-muted" aria-live="polite">
              {t("willCreate", {
                count: spots,
                first: formatTileCode({ zone, row: form.row, column: 1, level: 1 }),
                last: formatTileCode({ zone, row: form.row, column: spots, level: 1 }),
              })}
            </p>
          )}
          <FormError error={error} />
          <Button type="submit" loading={pending} disabled={!valid} className="justify-self-start">
            {t("addRow")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
