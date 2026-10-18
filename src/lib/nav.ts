import {
  ArrowDownToLine,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Grid3x3,
  History,
  Package,
  PackageX,
  ShoppingCart,
  Truck,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/server/auth/permissions";

export type NavItem = { slug: string; permission: Permission; icon: LucideIcon; built?: boolean };
export type NavGroup = { key: "masters" | "inventory" | "inward" | "outward" | "admin"; items: NavItem[] };

/** Sidebar modules. Labels live in messages/en.json under nav.items.<slug>. `built` = has a real screen. */
export const NAV: NavGroup[] = [
  {
    key: "masters",
    items: [
      { slug: "products", permission: "products.view", icon: Package, built: true },
      { slug: "locations", permission: "locations.view", icon: Grid3x3, built: true },
    ],
  },
  {
    key: "inventory",
    items: [
      { slug: "stock", permission: "stock.view", icon: Boxes, built: true },
      { slug: "stock-audits", permission: "audit.view", icon: ClipboardCheck },
      { slug: "adjustments", permission: "stock.view", icon: ArrowLeftRight },
    ],
  },
  {
    key: "inward",
    items: [
      { slug: "purchase-orders", permission: "purchase.view", icon: FileText },
      { slug: "inward", permission: "inward.view", icon: ArrowDownToLine },
    ],
  },
  {
    key: "outward",
    items: [
      { slug: "sales-orders", permission: "sales.view", icon: ShoppingCart },
      { slug: "picking", permission: "picking.view", icon: ClipboardList },
      { slug: "dispatch", permission: "dispatch.view", icon: Truck },
      { slug: "returns", permission: "returns.view", icon: Undo2 },
      { slug: "damages", permission: "returns.view", icon: PackageX },
    ],
  },
  {
    key: "admin",
    items: [
      { slug: "reports", permission: "reports.view", icon: BarChart3 },
      { slug: "users", permission: "users.view", icon: Users },
      { slug: "audit-log", permission: "auditlog.view", icon: History },
    ],
  },
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);
