import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { tenantDb } from "@/server/db/tenant";
import { recordMovements, reverseMovement } from "@/server/stock";
import { companies } from "./helpers";

let actor: { userId: string; companyId: string; warehouseId: string };
let productId: string;
let locationId: string;
let db: ReturnType<typeof tenantDb>;

const balance = async () =>
  (await db.stockBalance.aggregate({ where: { productId, locationId, batchId: null }, _sum: { quantity: true } }))._sum
    .quantity ?? 0;

beforeAll(async () => {
  const { bt } = await companies();
  const warehouseId = (await prisma.warehouse.findFirstOrThrow()).id;
  const user = await prisma.user.findFirstOrThrow({ where: { companyId: bt.id, role: "WAREHOUSE_MANAGER" } });
  actor = { userId: user.id, companyId: bt.id, warehouseId };
  db = tenantDb(bt.id, warehouseId);
  productId = (await prisma.product.findFirstOrThrow({ where: { companyId: bt.id }, orderBy: { sku: "desc" } })).id;
  locationId = (await prisma.location.findFirstOrThrow({ where: { companyId: bt.id, type: "RECEIVING" } })).id;
});

describe("stock_movements is append-only", () => {
  it("UPDATE is rejected by the database", async () => {
    const m = await prisma.stockMovement.findFirstOrThrow();
    await expect(prisma.stockMovement.update({ where: { id: m.id }, data: { quantity: 999 } })).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.stockMovement.updateMany({ data: { reason: "x" } })).rejects.toThrow(/append-only/);
  });

  it("DELETE is rejected by the database", async () => {
    const m = await prisma.stockMovement.findFirstOrThrow();
    await expect(prisma.stockMovement.delete({ where: { id: m.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.stockMovement.deleteMany()).rejects.toThrow(/append-only/);
  });

  it("raw SQL UPDATE / DELETE / TRUNCATE are rejected too", async () => {
    await expect(prisma.$executeRawUnsafe(`UPDATE stock_movements SET quantity = 1`)).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM stock_movements`)).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`TRUNCATE stock_movements CASCADE`)).rejects.toThrow(/append-only/);
  });

  it("quantity must be > 0 (zero is skipped, negative is rejected by the CHECK)", async () => {
    expect(await recordMovements(db, actor, [{ type: "INWARD", productId, locationId, quantity: 0 }])).toEqual([]);
    await expect(recordMovements(db, actor, [{ type: "INWARD", productId, locationId, quantity: -5 }])).rejects.toThrow(
      /quantity_chk/,
    );
  });
});

describe("stock is derived from movements", () => {
  it("balance view follows inward / outward / reversal", async () => {
    const start = await balance();
    await recordMovements(db, actor, [{ type: "INWARD", productId, locationId, quantity: 40 }]);
    expect(await balance()).toBe(start + 40);
    const [outward] = await recordMovements(db, actor, [{ type: "OUTWARD", productId, locationId, quantity: 15 }]);
    expect(await balance()).toBe(start + 25);

    // A mistake is fixed by a reversing entry; the original row is unchanged.
    const rev = await reverseMovement(db, actor, outward.id, "Entered by mistake");
    expect(rev).toMatchObject({ type: "OUTWARD", direction: 1, quantity: 15, reversalOfId: outward.id });
    expect(await balance()).toBe(start + 40);
    expect(await prisma.stockMovement.findUniqueOrThrow({ where: { id: outward.id } })).toMatchObject({
      quantity: 15,
      direction: -1,
    });
    // A movement can only be reversed once.
    await expect(reverseMovement(db, actor, outward.id, "again")).rejects.toThrow();
  });

  it("never goes negative: an outward larger than the balance is refused and nothing is written", async () => {
    const before = await balance();
    const count = await prisma.stockMovement.count();
    await expect(
      recordMovements(db, actor, [{ type: "OUTWARD", productId, locationId, quantity: before + 1 }]),
    ).rejects.toThrow(/Insufficient stock/);
    expect(await balance()).toBe(before);
    expect(await prisma.stockMovement.count()).toBe(count);
  });

  it("multi-row changes are atomic: one bad row rolls back the whole batch", async () => {
    const before = await balance();
    const count = await prisma.stockMovement.count();
    await expect(
      recordMovements(db, actor, [
        { type: "INWARD", productId, locationId, quantity: 5 },
        { type: "OUTWARD", productId, locationId, quantity: before + 1000 },
      ]),
    ).rejects.toThrow(/Insufficient stock/);
    expect(await balance()).toBe(before);
    expect(await prisma.stockMovement.count()).toBe(count);
  });

  it("concurrent outwards cannot oversell the last units", async () => {
    await recordMovements(db, actor, [{ type: "INWARD", productId, locationId, quantity: 10 }]);
    const available = await balance();
    const results = await Promise.allSettled([
      recordMovements(db, actor, [{ type: "OUTWARD", productId, locationId, quantity: available }]),
      recordMovements(db, actor, [{ type: "OUTWARD", productId, locationId, quantity: available }]),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await balance()).toBe(0);
  });
});
