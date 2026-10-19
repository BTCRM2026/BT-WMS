import {
  ArrowDownToLine,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Tag,
  Settings,
  Crown,
  ClipboardList,
  FileText,
  Grid3x3,
  History,
  Package,
  PackageCheck,
  PackageX,
  SlidersHorizontal,
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
      { slug: "labels", permission: "products.view", icon: Tag, built: true },
    ],
  },
  {
    key: "inventory",
    items: [
      { slug: "stock", permission: "stock.view", icon: Boxes, built: true },
      { slug: "transfers", permission: "stock.view", icon: ArrowLeftRight, built: true },
      { slug: "stock-audits", permission: "audit.view", icon: ClipboardCheck, built: true },
      { slug: "adjustments", permission: "stock.view", icon: SlidersHorizontal, built: true },
    ],
  },
  {
    key: "inward",
    items: [
      { slug: "purchase-orders", permission: "purchase.view", icon: FileText, built: true },
      { slug: "inward", permission: "inward.view", icon: ArrowDownToLine, built: true },
      { slug: "inward/putaway", permission: "inward.view", icon: PackageCheck, built: true },
    ],
  },
  {
    key: "outward",
    items: [
      { slug: "sales-orders", permission: "sales.view", icon: ShoppingCart, built: true },
      { slug: "picking", permission: "picking.view", icon: ClipboardList, built: true },
      { slug: "dispatch", permission: "dispatch.view", icon: Truck, built: true },
      { slug: "returns", permission: "returns.view", icon: Undo2, built: true },
      { slug: "damages", permission: "returns.view", icon: PackageX, built: true },
    ],
  },
  {
    key: "admin",
    items: [
      { slug: "reports", permission: "reports.view", icon: BarChart3, built: true },
      { slug: "owner", permission: "company.switch", icon: Crown, built: true },
      { slug: "users", permission: "users.view", icon: Users, built: true },
      { slug: "audit-log", permission: "auditlog.view", icon: History, built: true },
      { slug: "settings/company", permission: "users.manage", icon: Settings, built: true },
    ],
  },
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);
