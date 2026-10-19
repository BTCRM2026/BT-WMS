import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { callRoute, companies, signInAs, signOut, USERS } from "./helpers";

// Discover every API route file so new routes are covered automatically.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f === "route.ts" ? [p] : [];
  });
}
const API_DIR = path.resolve("src/app/api");
const ROUTES = walk(API_DIR).map((file) => ({
  file,
  url: "/api/" + path.relative(API_DIR, path.dirname(file)).split(path.sep).join("/"),
}));
const PUBLIC_ROUTES = new Set(["/api/health", "/api/cron/daily"]); // cron: shared-secret POST, tested separately
const PROTECTED = ROUTES.filter((r) => !PUBLIC_ROUTES.has(r.url));

let rfIds: Set<string>;
let rfCompanyId: string;
let rfProductId: string;

beforeAll(async () => {
  const { rf } = await companies();
  rfCompanyId = rf.id;
  const where = { companyId: rf.id };
  const ids = await Promise.all([
    prisma.product.findMany({ where, select: { id: true } }),
    prisma.location.findMany({ where, select: { id: true } }),
    prisma.batch.findMany({ where, select: { id: true } }),
    prisma.stockMovement.findMany({ where, select: { id: true } }),
    prisma.user.findMany({ where, select: { id: true } }),
  ]);
  rfIds = new Set(ids.flat().map((r) => r.id));
  rfProductId = (await prisma.product.findFirstOrThrow({ where })).id;
});

afterEach(signOut);

// Fill dynamic segments ([id]) with a Rich Fill id: a Bond Therapy user must get nothing back.
const fill = (url: string, id: string) => url.replace(/\[[^\]]+\]/g, id);
const paramsOf = (url: string, id: string) =>
  Object.fromEntries([...url.matchAll(/\[([^\]]+)\]/g)].map((m) => [m[1], id]));

describe("every API route", () => {
  it("found the routes", () => expect(PROTECTED.length).toBeGreaterThanOrEqual(6));

  it.each(PROTECTED)("$url is wrapped in apiRoute() (auth + permission)", ({ file }) => {
    const src = readFileSync(file, "utf8");
    const handlers = [...src.matchAll(/export (?:const|async function) (GET|POST|PUT|PATCH|DELETE)\b(.*)/g)];
    expect(handlers.length).toBeGreaterThan(0);
    for (const h of handlers) expect(h[2]).toMatch(/= apiRoute(<[^>]*>)?\(/);
  });

  it.each(PROTECTED)("$url returns 401 without a session", async ({ file, url }) => {
    const mod = await import(file);
    const res = await callRoute(mod.GET, "http://test" + fill(url, "x"), paramsOf(url, "x"));
    expect(res.status).toBe(401);
  });

  it.each(PROTECTED)("$url never returns Rich Fill data to a Bond Therapy user", async ({ file, url }) => {
    await signInAs(USERS.btAdmin);
    const mod = await import(file);
    const target = fill(url, rfProductId);
    const res = await callRoute(mod.GET, `http://test${target}?productId=${rfProductId}`, paramsOf(url, rfProductId));
    const body = await res.text();
    if (url.includes("[")) expect(res.status).toBe(404);
    expect(body).not.toContain(rfCompanyId);
    for (const id of rfIds) expect(body).not.toContain(id);
  });
});

// Server actions are checked statically: each must go through action(), which authenticates and checks permission.
describe("server actions", () => {
  it("every exported server action is built with action() (except login/logout)", () => {
    const actionFiles = (function find(dir: string): string[] {
      return readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) return find(p);
        return /\.(ts|tsx)$/.test(f) && /^["']use server["']/.test(readFileSync(p, "utf8")) ? [p] : [];
      });
    })(path.resolve("src/app"));
    expect(actionFiles.length).toBeGreaterThan(0);
    for (const f of actionFiles) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/export (const|async function) (\w+)(.*)/g)) {
        const [, kind, name, rest] = m;
        if (name === "login" || name === "logout") continue; // public / wraps a guarded action
        expect(kind === "const" && /= action\(/.test(rest), `${path.basename(f)}: ${name}`).toBe(true);
      }
    }
  });
});
