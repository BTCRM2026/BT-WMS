import type { Role } from "@prisma/client";

/**
 * The permission map. Code asks `can(role, "stock.adjust")`, never
 * `role === "ADMIN"`. Add a permission here, then grant it to roles below.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "company.switch",
  "users.view",
  "users.manage",
  "products.view",
  "products.manage",
  "locations.view",
  "locations.manage",
  "stock.view",
  "stock.move",
  "stock.adjust",
  "stock.approve",
  "purchase.view",
  "purchase.manage",
  "inward.view",
  "inward.manage",
  "sales.view",
  "sales.manage",
  "picking.view",
  "picking.manage",
  "dispatch.view",
  "dispatch.manage",
  "returns.view",
  "returns.manage",
  "audit.view",
  "audit.manage",
  "auditlog.view",
  "reports.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEW_ALL = PERMISSIONS.filter((p) => p.endsWith(".view") && p !== "users.view" && p !== "auditlog.view");

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: PERMISSIONS.filter((p) => p !== "company.switch"),
  WAREHOUSE_MANAGER: [
    ...VIEW_ALL,
    "products.manage",
    "locations.manage",
    "stock.move",
    "stock.adjust",
    "stock.approve",
    "purchase.manage",
    "inward.manage",
    "picking.manage",
    "dispatch.manage",
    "returns.manage",
    "audit.manage",
  ],
  STORE_KEEPER: [
    "dashboard.view",
    "products.view",
    "locations.view",
    "stock.view",
    "stock.move",
    "inward.view",
    "inward.manage",
    "picking.view",
    "picking.manage",
    "dispatch.view",
    "dispatch.manage",
    "returns.view",
    "returns.manage",
    "audit.view",
    "audit.manage",
  ],
  BILLING: [
    "dashboard.view",
    "products.view",
    "stock.view",
    "purchase.view",
    "purchase.manage",
    "sales.view",
    "sales.manage",
    "dispatch.view",
    "returns.view",
    "reports.view",
  ],
  VIEWER: VIEW_ALL,
};

const lookup = new Map(Object.entries(ROLE_PERMISSIONS).map(([r, ps]) => [r, new Set<string>(ps)]));

export function can(role: Role, permission: Permission): boolean {
  return lookup.get(role)?.has(permission) ?? false;
}
