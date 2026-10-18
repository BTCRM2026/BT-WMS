import { ZodError } from "zod";
import { getContext, HttpError, type Context } from "@/server/auth/context";
import { can, type Permission } from "@/server/auth/permissions";
import { TenantViolation } from "@/server/db/tenant";
import { logger } from "@/server/log";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Every server action is built with this: authenticate, check permission,
 * run, and return a friendly result (never a stack trace).
 * "authenticated" = any signed-in user (e.g. change own password).
 */
export function action<I, O>(permission: Permission | "authenticated", fn: (ctx: Context, input: I) => Promise<O>) {
  return async (input: I): Promise<ActionResult<O>> => {
    const ctx = await getContext();
    try {
      if (!ctx) throw new HttpError(401, "Please sign in again.");
      if (permission !== "authenticated" && !can(ctx.user.role, permission)) {
        throw new HttpError(403, "You do not have permission to do this.");
      }
      return { ok: true, data: await fn(ctx, input) };
    } catch (e) {
      if (e instanceof HttpError) return { ok: false, error: e.message };
      if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input." };
      if (e instanceof TenantViolation) return { ok: false, error: "Not found." };
      logger.error("action.error", { requestId: ctx?.requestId, error: String(e), stack: (e as Error)?.stack });
      return { ok: false, error: `Something went wrong. Reference: ${ctx?.requestId ?? "n/a"}` };
    }
  };
}
