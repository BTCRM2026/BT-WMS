import { prisma } from "@/server/db/client";
import { attemptLogin } from "@/server/auth/login";
import { SESSION_COOKIE } from "@/server/auth/session";
import { fakeRequest } from "./setup";

export const PASSWORD = "ChangeMe!2026";

export const USERS = {
  owner: "owner@btwarehouse.test",
  btAdmin: "admin@bondtherapy.test",
  btManager: "warehousemanager@bondtherapy.test",
  btKeeper: "storekeeper@bondtherapy.test",
  btBilling: "billing@bondtherapy.test",
  btViewer: "viewer@bondtherapy.test",
  rfAdmin: "admin@richfill.test",
  rfViewer: "viewer@richfill.test",
} as const;

/** Log in for real and make the fake request carry the session cookie. */
export async function signInAs(email: string) {
  const r = await attemptLogin({ email, password: PASSWORD, ip: "10.0.0.1" });
  if (!r.ok) throw new Error(`login failed for ${email}: ${r.error}`);
  fakeRequest.cookies.set(SESSION_COOKIE, r.token);
}

export function signOut() {
  fakeRequest.cookies.clear();
}

export async function companies() {
  const [bt, rf] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { slug: "bond-therapy" } }),
    prisma.company.findUniqueOrThrow({ where: { slug: "rich-fill" } }),
  ]);
  return { bt, rf };
}

export const callRoute = (
  handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
  url = "http://test/api",
  params: Record<string, string> = {},
) => handler(new Request(url), { params: Promise.resolve(params) });
