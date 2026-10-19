import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Tenant-scoped data access. Every query through tenantDb(companyId) is
 * forced onto that company:
 *  - reads/updates/deletes get `companyId` AND-ed into `where`
 *  - creates get `companyId` (and a default `warehouseId`) written into `data`
 *  - the Company model is pinned to its own row
 *  - auth tables (sessions, login attempts) are not reachable at all
 *  - include/select may not hop through a global table (warehouses) back into
 *    tenant data, which would otherwise bypass the filter
 *
 * The set of scoped models is derived from the schema: any model with a
 * `companyId` field is scoped automatically, so a new table cannot be missed.
 * The database adds a second wall: composite (id, company_id) foreign keys.
 */

const models = Prisma.dmmf.datamodel.models;
const fieldsOf = new Map(models.map((m) => [m.name, m.fields]));

export const TENANT_MODELS = new Set(
  models.filter((m) => m.fields.some((f) => f.name === "companyId")).map((m) => m.name),
);
// Views are not in dmmf.models in every Prisma version; StockBalance is scoped explicitly.
TENANT_MODELS.add("StockBalance");

export const GLOBAL_MODELS = new Set(["Warehouse", "RolePermission"]);
export const BLOCKED_MODELS = new Set(["Session", "LoginAttempt", "JobRun"]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

const READ_OPS = new Set(
  [...WHERE_OPS].filter((o) => o.startsWith("find") || ["count", "aggregate", "groupBy"].includes(o)),
);

const hasWarehouse = (model: string) => !!fieldsOf.get(model)?.some((f) => f.name === "warehouseId");

export class TenantViolation extends Error {}

type Args = Record<string, unknown>;

/** Reject include/select trees that pass from a global model into tenant data. */
function checkNesting(model: string, node: unknown, viaGlobal: boolean) {
  if (!node || typeof node !== "object") return;
  const fields = fieldsOf.get(model) ?? [];
  for (const key of ["include", "select"] as const) {
    const tree = (node as Args)[key];
    if (!tree || typeof tree !== "object") continue;
    for (const [name, value] of Object.entries(tree as Args)) {
      const f = fields.find((x) => x.name === name);
      if (!f || f.kind !== "object" || !value) continue;
      const target = f.type;
      const nowGlobal = GLOBAL_MODELS.has(model) || viaGlobal;
      if (BLOCKED_MODELS.has(target) || (nowGlobal && TENANT_MODELS.has(target))) {
        throw new TenantViolation(`Relation ${model}.${name} is not reachable from a tenant client`);
      }
      checkNesting(target, value, nowGlobal);
    }
  }
}

// AND the tenant filter in (never overwrite), so a caller-supplied companyId for
// another company yields no rows. Unique fields stay at the top level for findUnique/update.
function andWhere(where: unknown, filter: Args): Args {
  const w = (where ?? {}) as Args;
  const and = w.AND === undefined ? [] : Array.isArray(w.AND) ? w.AND : [w.AND];
  return { ...w, AND: [...and, filter] };
}

function scopeData(data: unknown, companyId: string, warehouseId?: string): unknown {
  if (Array.isArray(data)) return data.map((d) => scopeData(d, companyId, warehouseId));
  if (!data || typeof data !== "object") return data;
  const d = data as Args;
  if (d.companyId !== undefined && d.companyId !== companyId) {
    throw new TenantViolation("Cannot write data for another company");
  }
  return { ...(warehouseId ? { warehouseId } : {}), ...d, companyId };
}

function guardUpdateData(data: unknown, companyId: string) {
  const d = data as Args | undefined;
  if (d && d.companyId !== undefined && d.companyId !== companyId) {
    throw new TenantViolation("Cannot move data to another company");
  }
}

export function tenantDb(companyId: string, warehouseId?: string) {
  if (!companyId) throw new TenantViolation("companyId is required");

  return prisma.$extends({
    name: "tenant",
    query: {
      async $allOperations({ model, operation, args, query }) {
        if (!model) return query(args); // $queryRaw etc. (lint-banned outside src/server/db)
        if (BLOCKED_MODELS.has(model)) throw new TenantViolation(`${model} is not accessible here`);

        const a = { ...(args as Args) };
        checkNesting(model, a, false);

        if (model === "Company") {
          if (!WHERE_OPS.has(operation) || operation === "upsert" || operation.startsWith("delete")) {
            throw new TenantViolation(`Company.${operation} is not allowed from a tenant client`);
          }
          a.where = andWhere(a.where, { id: companyId });
          return query(a);
        }

        if (GLOBAL_MODELS.has(model)) {
          if (!READ_OPS.has(operation)) throw new TenantViolation(`${model} is read-only from a tenant client`);
          return query(a);
        }
        // Fail closed: a model that is neither tenant-scoped nor declared global is unreachable.
        if (!TENANT_MODELS.has(model)) throw new TenantViolation(`${model} is not classified for tenancy`);

        if (WHERE_OPS.has(operation)) a.where = andWhere(a.where, { companyId });
        if (operation === "create" || operation === "createMany" || operation === "createManyAndReturn") {
          a.data = scopeData(a.data, companyId, hasWarehouse(model) ? warehouseId : undefined);
        }
        if (operation === "upsert") {
          a.create = scopeData(a.create, companyId, hasWarehouse(model) ? warehouseId : undefined);
          guardUpdateData(a.update, companyId);
        }
        if (operation.startsWith("update")) guardUpdateData(a.data, companyId);

        return query(a);
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
