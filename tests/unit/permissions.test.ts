import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, ROLE_PERMISSIONS } from "@/server/auth/permissions";

const ROLES = Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[];

describe("permission map", () => {
  it("covers all six roles", () => {
    expect(ROLES.sort()).toEqual(["ADMIN", "BILLING", "STORE_KEEPER", "SUPER_ADMIN", "VIEWER", "WAREHOUSE_MANAGER"]);
  });

  it("only grants known permissions, without duplicates", () => {
    for (const r of ROLES) {
      for (const p of ROLE_PERMISSIONS[r]) expect(PERMISSIONS).toContain(p);
      expect(new Set(ROLE_PERMISSIONS[r]).size).toBe(ROLE_PERMISSIONS[r].length);
    }
  });

  it("SUPER_ADMIN has everything; only SUPER_ADMIN can switch company", () => {
    for (const p of PERMISSIONS) expect(can("SUPER_ADMIN", p)).toBe(true);
    for (const r of ROLES.filter((r) => r !== "SUPER_ADMIN")) expect(can(r, "company.switch")).toBe(false);
  });

  it("every role can open the dashboard", () => {
    for (const r of ROLES) expect(can(r, "dashboard.view")).toBe(true);
  });

  it("VIEWER can never change anything", () => {
    const writes = PERMISSIONS.filter((p) => !p.endsWith(".view"));
    for (const p of writes) expect(can("VIEWER", p)).toBe(false);
  });

  it("STORE_KEEPER moves stock but cannot adjust, approve or manage users", () => {
    expect(can("STORE_KEEPER", "stock.move")).toBe(true);
    expect(can("STORE_KEEPER", "stock.adjust")).toBe(false);
    expect(can("STORE_KEEPER", "stock.approve")).toBe(false);
    expect(can("STORE_KEEPER", "users.view")).toBe(false);
  });

  it("BILLING handles orders but not stock or tiles", () => {
    expect(can("BILLING", "sales.manage")).toBe(true);
    expect(can("BILLING", "stock.move")).toBe(false);
    expect(can("BILLING", "locations.view")).toBe(false);
  });

  it("only ADMIN and above manage users", () => {
    expect(ROLES.filter((r) => can(r, "users.manage")).sort()).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });

  it("returns false for unknown roles", () => {
    expect(can("HACKER" as never, "dashboard.view")).toBe(false);
  });
});
