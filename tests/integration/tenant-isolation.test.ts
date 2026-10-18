import { Prisma } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { BLOCKED_MODELS, GLOBAL_MODELS, TENANT_MODELS, tenantDb, TenantViolation } from "@/server/db/tenant";
import { companies } from "./helpers";
import { createTenantRows } from "./fixtures";

const delegate = (db: unknown, model: string) =>
  (db as Record<string, Record<string, (a?: unknown) => Promise<unknown>>>)[model[0].toLowerCase() + model.slice(1)];

let bt: { id: string };
let rf: { id: string };
let btRows: Record<string, string>;
let rfRows: Record<string, string>;
const VIEWS = new Set(["StockBalance"]);
const APPEND_ONLY = new Set(["StockMovement"]);

beforeAll(async () => {
  ({ bt, rf } = await companies());
  btRows = await createTenantRows(bt.id, "BT-ISO");
  rfRows = await createTenantRows(rf.id, "RF-ISO");
});

describe("tenant classification", () => {
  it("every model is tenant-scoped, global, blocked, or Company", () => {
    for (const m of Prisma.dmmf.datamodel.models.map((m) => m.name)) {
      expect(TENANT_MODELS.has(m) || GLOBAL_MODELS.has(m) || BLOCKED_MODELS.has(m) || m === "Company", m).toBe(true);
    }
  });

  it("fixtures cover every tenant table", () => {
    expect(Object.keys(rfRows).sort()).toEqual([...TENANT_MODELS].sort());
  });
});

describe("Bond Therapy client never sees or touches Rich Fill rows", () => {
  const models = [...TENANT_MODELS];

  it.each(models)("%s: findMany / findFirst / count / aggregate see only own company", async (model) => {
    const d = delegate(tenantDb(bt.id), model);
    const rows = (await d.findMany({ take: 1000 })) as { companyId: string | null }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.companyId === bt.id)).toBe(true);
    expect(await d.findFirst({ where: { id: rfRows[model] } })).toBeNull();
    // Trying to smuggle the other company id into the filter does not help.
    expect(await d.findMany({ where: { companyId: rf.id } })).toEqual([]);
    expect(await d.findMany({ where: { OR: [{ companyId: rf.id }, { id: rfRows[model] }] } })).toEqual([]);
    expect(await d.count({ where: { id: rfRows[model] } })).toBe(0);
  });

  it.each(models.filter((m) => !VIEWS.has(m)))(
    "%s: findUnique by the other company's id returns null",
    async (model) => {
      const d = delegate(tenantDb(bt.id), model);
      expect(await d.findUnique({ where: { id: rfRows[model] } })).toBeNull();
      expect(await d.findUnique({ where: { id: btRows[model] } })).not.toBeNull();
    },
  );

  it.each(models.filter((m) => !VIEWS.has(m) && !APPEND_ONLY.has(m)))(
    "%s: update / delete of the other company's row fail",
    async (model) => {
      const d = delegate(tenantDb(bt.id), model);
      const where = { id: rfRows[model] };
      await expect(d.update({ where, data: {} })).rejects.toMatchObject({ code: "P2025" });
      await expect(d.delete({ where })).rejects.toMatchObject({ code: "P2025" });
      expect(await d.updateMany({ where, data: {} })).toEqual({ count: 0 });
      expect(await d.deleteMany({ where })).toEqual({ count: 0 });
      // The row is still there, untouched.
      expect(await delegate(prisma, model).findUnique({ where })).not.toBeNull();
    },
  );

  it.each(models.filter((m) => !VIEWS.has(m)))("%s: cannot create rows for the other company", async (model) => {
    const d = delegate(tenantDb(bt.id), model);
    await expect(d.create({ data: { companyId: rf.id } })).rejects.toBeInstanceOf(TenantViolation);
    await expect(d.createMany({ data: [{ companyId: rf.id }] })).rejects.toBeInstanceOf(TenantViolation);
  });

  it("cannot move a row to the other company", async () => {
    const db = tenantDb(bt.id);
    await expect(
      db.product.update({ where: { id: btRows.Product }, data: { companyId: rf.id } }),
    ).rejects.toBeInstanceOf(TenantViolation);
  });

  it("database rejects own rows that point at the other company's product/tile (composite FK)", async () => {
    const db = tenantDb(bt.id);
    const user = await prisma.user.findFirstOrThrow({ where: { companyId: bt.id } });
    const wh = await prisma.warehouse.findFirstOrThrow();
    await expect(
      db.stockMovement.create({
        data: {
          companyId: bt.id,
          warehouseId: wh.id,
          type: "INWARD",
          direction: 1,
          quantity: 1,
          productId: rfRows.Product,
          locationId: btRows.Location,
          userId: user.id,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      db.purchaseOrderLine.create({
        data: {
          companyId: bt.id,
          warehouseId: wh.id,
          purchaseOrderId: btRows.PurchaseOrder,
          productId: rfRows.Product,
          quantity: 1,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("Company is pinned to its own row", async () => {
    const db = tenantDb(bt.id);
    expect((await db.company.findMany()).map((c) => c.id)).toEqual([bt.id]);
    expect(await db.company.findUnique({ where: { id: rf.id } })).toBeNull();
    await expect(db.company.create({ data: { name: "x", slug: "x", code: "XX" } })).rejects.toBeInstanceOf(
      TenantViolation,
    );
  });

  it("auth tables are unreachable and global tables are read-only", async () => {
    const db = tenantDb(bt.id);
    await expect(db.session.findMany()).rejects.toBeInstanceOf(TenantViolation);
    await expect(db.loginAttempt.findMany()).rejects.toBeInstanceOf(TenantViolation);
    await expect(db.warehouse.create({ data: { code: "W9", name: "x" } })).rejects.toBeInstanceOf(TenantViolation);
    expect(await db.warehouse.count()).toBe(1);
  });

  it("cannot hop through a global table back into tenant data", async () => {
    const db = tenantDb(bt.id);
    await expect(db.warehouse.findMany({ include: { products: true } })).rejects.toBeInstanceOf(TenantViolation);
    await expect(
      db.product.findMany({ include: { warehouse: { include: { locations: true } } } }),
    ).rejects.toBeInstanceOf(TenantViolation);
    await expect(db.user.findMany({ include: { sessions: true } })).rejects.toBeInstanceOf(TenantViolation);
  });

  it("includes of own relations only return own rows", async () => {
    const p = await tenantDb(bt.id).product.findMany({ include: { batches: true, movements: true, company: true } });
    for (const row of p) {
      expect(row.company.id).toBe(bt.id);
      expect(row.batches.every((b) => b.companyId === bt.id)).toBe(true);
      expect(row.movements.every((m) => m.companyId === bt.id)).toBe(true);
    }
  });

  it("works the same inside interactive transactions", async () => {
    const out = await tenantDb(bt.id).$transaction(async (tx) => ({
      foreign: await tx.product.findUnique({ where: { id: rfRows.Product } }),
      count: await tx.product.count(),
    }));
    expect(out.foreign).toBeNull();
    expect(out.count).toBe(await prisma.product.count({ where: { companyId: bt.id } }));
  });

  it("and the reverse: Rich Fill cannot see Bond Therapy", async () => {
    const db = tenantDb(rf.id);
    expect(await db.product.findUnique({ where: { id: btRows.Product } })).toBeNull();
    expect((await db.stockBalance.findMany()).every((b) => b.companyId === rf.id)).toBe(true);
  });
});
