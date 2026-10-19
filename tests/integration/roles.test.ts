import { prisma } from "@/server/db/client";
import { afterEach, describe, expect, it } from "vitest";
import { getContext, requirePage } from "@/server/auth/context";
import { switchCompany } from "@/app/(app)/actions";
import { GET as usersRoute } from "@/app/api/users/route";
import { GET as locationsRoute } from "@/app/api/locations/route";
import { GET as productsRoute } from "@/app/api/products/route";
import { callRoute, companies, signInAs, signOut, USERS } from "./helpers";

afterEach(signOut);

describe("role enforcement on API routes", () => {
  it.each([
    [USERS.btAdmin, "/api/users", usersRoute, 200],
    [USERS.btViewer, "/api/users", usersRoute, 403],
    [USERS.btKeeper, "/api/users", usersRoute, 403],
    [USERS.btBilling, "/api/users", usersRoute, 403],
    [USERS.btBilling, "/api/locations", locationsRoute, 403],
    [USERS.btKeeper, "/api/locations", locationsRoute, 200],
    [USERS.btViewer, "/api/products", productsRoute, 200],
  ] as const)("%s GET %s -> %i", async (email, _url, route, status) => {
    await signInAs(email);
    expect((await callRoute(route)).status).toBe(status);
  });
});

describe("role enforcement on pages", () => {
  it("redirects a STORE_KEEPER away from the users page", async () => {
    await signInAs(USERS.btKeeper);
    await expect(requirePage("users.view")).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("lets an ADMIN in", async () => {
    await signInAs(USERS.btAdmin);
    await expect(requirePage("users.view")).resolves.toBeTruthy();
  });

  it("sends anonymous users to login", async () => {
    await expect(requirePage()).rejects.toThrow(/NEXT_REDIRECT/);
  });
});

describe("company switching", () => {
  it("is refused for a company ADMIN", async () => {
    const { rf } = await companies();
    await signInAs(USERS.btAdmin);
    const r = await switchCompany(rf.id);
    expect(r.ok).toBe(false);
    expect((await getContext())!.company.slug).toBe("bond-therapy");
  });

  it("works for the SUPER_ADMIN owner and re-scopes all data", async () => {
    const { bt, rf } = await companies();
    await signInAs(USERS.owner);
    expect((await getContext())!.company.id).toBe(bt.id);
    expect((await switchCompany(rf.id)).ok).toBe(true);
    const ctx = (await getContext())!;
    expect(ctx.company.id).toBe(rf.id);
    const products = await ctx.db.product.findMany();
    expect(products.length).toBe(await prisma.product.count({ where: { companyId: rf.id } }));
    expect(products.every((p) => p.companyId === rf.id)).toBe(true);
  });

  it("rejects switching to a company that does not exist", async () => {
    await signInAs(USERS.owner);
    expect((await switchCompany("nope")).ok).toBe(false);
  });
});
