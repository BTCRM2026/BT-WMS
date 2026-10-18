import { prisma } from "@/server/db/client";
import { audit } from "@/server/audit";
import { createSession } from "./session";
import { dummyHash, verifyPassword } from "./password";

export const LOCKOUT = { maxFailures: 5, lockMinutes: 15 };
export const RATE_LIMIT = { maxFailuresPerIp: 20, windowMinutes: 15 };

export type LoginResult =
  { ok: true; token: string; expiresAt: Date } | { ok: false; error: "invalid" | "locked" | "rate_limited" };

type Input = { email: string; password: string; ip: string; userAgent?: string; requestId?: string };

export async function attemptLogin({ email, password, ip, userAgent, requestId }: Input): Promise<LoginResult> {
  email = email.trim().toLowerCase();
  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000);
  const meta = { ip, userAgent, requestId };

  // Per-IP rate limit, stored in Postgres so it holds across restarts and instances.
  const recentFailures = await prisma.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } });
  if (recentFailures >= RATE_LIMIT.maxFailuresPerIp) {
    await audit({ action: "auth.rate_limited", entity: "user", after: { email }, ...meta });
    return { ok: false, error: "rate_limited" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const fail = async (error: "invalid" | "locked") => {
    await prisma.loginAttempt.create({ data: { email, ip, success: false } });
    await audit({
      companyId: user?.companyId,
      userId: user?.id,
      action: error === "locked" ? "auth.login_locked" : "auth.login_failed",
      entity: "user",
      entityId: user?.id,
      after: { email },
      ...meta,
    });
    return { ok: false as const, error };
  };

  if (!user || !user.isActive) {
    await verifyPassword(password, await dummyHash()); // same timing as a real check
    return fail("invalid");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return fail("locked");

  if (!(await verifyPassword(password, user.passwordHash))) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
    });
    if (updated.failedLoginCount >= LOCKOUT.maxFailures) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT.lockMinutes * 60_000) },
      });
      await audit({
        companyId: user.companyId,
        userId: user.id,
        action: "auth.account_locked",
        entity: "user",
        entityId: user.id,
        ...meta,
      });
      return fail("locked");
    }
    return fail("invalid");
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await prisma.loginAttempt.create({ data: { email, ip, success: true } });
  const session = await createSession(user.id, user.companyId, ip, userAgent);
  await audit({
    companyId: user.companyId,
    userId: user.id,
    action: "auth.login",
    entity: "user",
    entityId: user.id,
    ...meta,
  });
  return { ok: true, ...session };
}
