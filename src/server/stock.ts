import type { MovementType } from "@prisma/client";
import { audit, type AuditEntry } from "@/server/audit";
import type { TenantDb } from "@/server/db/tenant";

export const DIRECTION: Record<MovementType, 1 | -1 | null> = {
  INWARD: 1,
  TRANSFER_IN: 1,
  RETURN: 1,
  OUTWARD: -1,
  TRANSFER_OUT: -1,
  DAMAGE: -1,
  ADJUSTMENT: null, // caller decides
};

export type MovementInput = {
  type: MovementType;
  productId: string;
  locationId: string;
  batchId?: string | null;
  quantity: number;
  direction?: 1 | -1;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
};

type Actor = { userId: string; companyId: string; warehouseId: string } & Omit<
  AuditEntry,
  "action" | "entity" | "companyId"
>;

/**
 * The only way stock changes: all rows insert in ONE transaction with their
 * audit entries, or none do. The DB trigger rejects any row that would take a
 * balance below zero, which rolls the whole batch back.
 */
export async function recordMovements(db: TenantDb, actor: Actor, rows: MovementInput[]) {
  return db.$transaction(async (tx) => {
    const created = [];
    for (const r of rows) {
      const direction = DIRECTION[r.type] ?? r.direction;
      if (!direction) throw new Error("ADJUSTMENT needs an explicit direction");
      const m = await tx.stockMovement.create({
        data: {
          companyId: actor.companyId,
          warehouseId: actor.warehouseId,
          type: r.type,
          direction,
          productId: r.productId,
          locationId: r.locationId,
          batchId: r.batchId ?? null,
          quantity: r.quantity,
          referenceType: r.referenceType,
          referenceId: r.referenceId,
          reason: r.reason,
          userId: actor.userId,
        },
      });
      await audit({ ...actor, action: "stock.movement", entity: "stock_movement", entityId: m.id, after: m }, tx);
      created.push(m);
    }
    return created;
  });
}

/** Undo a movement by posting its mirror image. The original row stays untouched. */
export async function reverseMovement(db: TenantDb, actor: Actor, movementId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const orig = await tx.stockMovement.findUniqueOrThrow({ where: { id: movementId } });
    const m = await tx.stockMovement.create({
      data: {
        companyId: orig.companyId,
        warehouseId: orig.warehouseId,
        type: orig.type,
        direction: -orig.direction,
        productId: orig.productId,
        locationId: orig.locationId,
        batchId: orig.batchId,
        quantity: orig.quantity,
        referenceType: "REVERSAL",
        referenceId: orig.id,
        reversalOfId: orig.id,
        reason,
        userId: actor.userId,
      },
    });
    await audit(
      { ...actor, action: "stock.reversal", entity: "stock_movement", entityId: m.id, before: orig, after: m },
      tx,
    );
    return m;
  });
}
