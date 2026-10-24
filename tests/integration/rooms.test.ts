import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getContext, HttpError, type Context } from "@/server/auth/context";
import { generateTiles, saveRoom } from "@/server/ops/masters";
import { tilesWithStock } from "@/server/insights";
import { summarizeRooms } from "@/lib/rooms";
import { saveRoomAction } from "@/app/(app)/locations/actions";
import { signInAs, USERS } from "./helpers";

async function as(email: string) {
  await signInAs(email);
  return (await getContext())!;
}

let bt: Context;

beforeAll(async () => {
  bt = await as(USERS.btManager);
});

describe("rooms", () => {
  it("creates a room, adds a row of tiles to it and summarizes it", async () => {
    const { zone } = await saveRoom(bt, { data: { zone: "bt7", name: " Room 7 ", note: "Near the gate" } });
    expect(zone).toBe("BT7");
    const room = await prisma.room.findFirstOrThrow({ where: { zone: "BT7" } });
    expect(room).toMatchObject({ name: "Room 7", note: "Near the gate", companyId: bt.company.id });
    expect(await prisma.auditLog.count({ where: { action: "room.create", entityId: room.id } })).toBe(1);

    const g = await generateTiles(bt, { zone: "BT7", rows: "A", columnFrom: 1, columnTo: 4, capacity: 20 });
    expect(g).toMatchObject({ created: 4, skipped: 0 });
    const tiles = (await tilesWithStock(bt.db)).filter((t) => t.zone === "BT7");
    expect(tiles.map((t) => t.code)).toEqual(["BT7-A-01-1", "BT7-A-02-1", "BT7-A-03-1", "BT7-A-04-1"]);
    const [s] = summarizeRooms([room], tiles);
    expect(s).toMatchObject({ name: "Room 7", tiles: 4, used: 0, boxes: 0, capacity: 80 });
  });

  it("renames a room but keeps its code", async () => {
    const room = await prisma.room.findFirstOrThrow({ where: { zone: "BT7" } });
    await saveRoom(bt, { id: room.id, data: { zone: "BT9", name: "Sections room", note: "" } });
    expect(await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).toMatchObject({
      zone: "BT7",
      name: "Sections room",
      note: null,
    });
  });

  it("rejects a duplicate code, another company's prefix and a blank name", async () => {
    await expect(saveRoom(bt, { data: { zone: "BT7", name: "Again" } })).rejects.toMatchObject({ status: 409 });
    await expect(saveRoom(bt, { data: { zone: "RF7", name: "Theirs" } })).rejects.toBeInstanceOf(HttpError);
    await expect(saveRoom(bt, { data: { zone: "BT8", name: "   " } })).rejects.toThrow();
    await expect(saveRoom(bt, { data: { zone: "B", name: "Short" } })).rejects.toThrow();
  });

  it("another company cannot see or rename the room", async () => {
    const room = await prisma.room.findFirstOrThrow({ where: { zone: "BT7" } });
    const rf = await as(USERS.rfAdmin);
    expect(await rf.db.room.findFirst({ where: { zone: "BT7" } })).toBeNull();
    await expect(saveRoom(rf, { id: room.id, data: { zone: "BT7", name: "Hijack" } })).rejects.toMatchObject({
      status: 404,
    });
    expect((await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).name).toBe("Sections room");
  });

  it("only users who manage tiles can save a room", async () => {
    await signInAs(USERS.btViewer);
    const r = await saveRoomAction({ key: "rooms-viewer", data: { zone: "BT6", name: "Nope" } });
    expect(r.ok).toBe(false);
    expect(await prisma.room.count({ where: { zone: "BT6" } })).toBe(0);
  });
});
