import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";
import { tenantDb, TenantViolation } from "@/server/db/tenant";
import { logger } from "@/server/log";
import { can, type Permission } from "./permissions";
import { loadSession, SESSION_COOKIE } from "./session";

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown",
    userAgent: h.get("user-agent") ?? undefined,
    requestId: h.get("x-request-id") ?? undefined,
  };
}

const firstWarehouseId = cache(async () => (await prisma.warehouse.findFirst({ orderBy: { createdAt: "asc" } }))?.id);

/** The logged-in user, the company they are acting for, and a tenant-scoped db. Cached per request. */
export const getContext = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await loadSession(token);
  if (!session) return null;

  const { user } = session;
  // Only roles allowed to switch may act for a company other than their own.
  const company = can(user.role, "company.switch") ? session.activeCompany : user.company;
  const warehouseId = await firstWarehouseId();
  const meta = await requestMeta();

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
    company,
    warehouseId,
    db: tenantDb(company.id, warehouseId),
    can: (p: Permission) => can(user.role, p),
    ...meta,
    /** Fields for audit(): who, which company, from where. */
    auditMeta: { companyId: company.id, userId: user.id, ...meta },
  };
});

export type Context = NonNullable<Awaited<ReturnType<typeof getContext>>>;

/** For pages and layouts. */
export async function requirePage(permission?: Permission): Promise<Context> {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  if (permission && !ctx.can(permission)) redirect("/forbidden");
  return ctx;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** For server actions: throws instead of redirecting. */
export async function requireAction(permission: Permission): Promise<Context> {
  const ctx = await getContext();
  if (!ctx) throw new HttpError(401, "Please sign in again.");
  if (!ctx.can(permission)) throw new HttpError(403, "You do not have permission to do this.");
  return ctx;
}

type Handler<P> = (ctx: Context, req: Request, params: P) => Promise<Response | unknown>;

/**
 * Every API route handler is wrapped in this. It authenticates, checks the
 * permission, and turns errors into friendly JSON without leaking internals.
 */
export function apiRoute<P = Record<string, string>>(permission: Permission, handler: Handler<P>) {
  return async (req: Request, { params }: { params: Promise<P> }) => {
    const meta = await requestMeta();
    try {
      const ctx = await getContext();
      if (!ctx) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
      if (!ctx.can(permission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const out = await handler(ctx, req, await params);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof TenantViolation) return NextResponse.json({ error: "Not found" }, { status: 404 });
      logger.error("api.error", {
        requestId: meta.requestId,
        url: req.url,
        error: String(e),
        stack: (e as Error)?.stack,
      });
      return NextResponse.json(
        { error: "Something went wrong. Please try again.", requestId: meta.requestId },
        { status: 500 },
      );
    }
  };
}
