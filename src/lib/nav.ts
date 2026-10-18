import type { Permission } from "@/server/auth/permissions";

export type NavItem = { slug: string; label: string; permission: Permission };
export type NavGroup = { label: string; items: NavItem[] };

/** Sidebar modules. Pages for these are placeholders until each module is built. */
export const NAV: NavGroup[] = [
  {
    label: "Masters",
    items: [
      { slug: "products", label: "Products", permission: "products.view" },
      { slug: "locations", label: "Locations / Tiles", permission: "locations.view" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { slug: "stock", label: "Stock", permission: "stock.view" },
      { slug: "stock-audits", label: "Stock Audits", permission: "audit.view" },
      { slug: "adjustments", label: "Adjustments", permission: "stock.view" },
    ],
  },
  {
    label: "Inward",
    items: [
      { slug: "purchase-orders", label: "Purchase Orders", permission: "purchase.view" },
      { slug: "inward", label: "Inward Receipts", permission: "inward.view" },
    ],
  },
  {
    label: "Outward",
    items: [
      { slug: "sales-orders", label: "Sales Orders", permission: "sales.view" },
      { slug: "picking", label: "Pick Lists", permission: "picking.view" },
      { slug: "dispatch", label: "Dispatch", permission: "dispatch.view" },
      { slug: "returns", label: "Returns", permission: "returns.view" },
      { slug: "damages", label: "Damages", permission: "returns.view" },
    ],
  },
  {
    label: "Admin",
    items: [
      { slug: "reports", label: "Reports", permission: "reports.view" },
      { slug: "users", label: "Users", permission: "users.view" },
      { slug: "audit-log", label: "Audit Log", permission: "auditlog.view" },
    ],
  },
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);
