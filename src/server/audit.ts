import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

export type AuditEntry = {
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

type Writer = { auditLog: { create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown> } };

const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));

/** Pass a transaction client as `db` so the audit row commits or rolls back with the change. */
export async function audit(e: AuditEntry, db: Writer = prisma) {
  await db.auditLog.create({
    data: {
      companyId: e.companyId,
      userId: e.userId,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      before: json(e.before),
      after: json(e.after),
      ip: e.ip,
      userAgent: e.userAgent,
      requestId: e.requestId,
    },
  });
}
