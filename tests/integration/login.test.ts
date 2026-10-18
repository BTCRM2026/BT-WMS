import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { attemptLogin, LOCKOUT, RATE_LIMIT } from "@/server/auth/login";
import { loadSession } from "@/server/auth/session";
import { PASSWORD, USERS } from "./helpers";

const ip = () => `10.1.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

describe("login", () => {
  it("accepts the right password and creates a working session", async () => {
    const r = await attemptLogin({ email: USERS.rfViewer, password: PASSWORD, ip: ip() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = await loadSession(r.token);
    expect(s?.user.email).toBe(USERS.rfViewer);
  });

  it("is case-insensitive on email", async () => {
    expect((await attemptLogin({ email: USERS.rfViewer.toUpperCase(), password: PASSWORD, ip: ip() })).ok).toBe(true);
  });

  it("gives the same answer for unknown email and wrong password", async () => {
    const a = await attemptLogin({ email: "nobody@nowhere.test", password: PASSWORD, ip: ip() });
    const b = await attemptLogin({ email: USERS.rfViewer, password: "wrong", ip: ip() });
    expect(a).toEqual({ ok: false, error: "invalid" });
    expect(b).toEqual({ ok: false, error: "invalid" });
  });

  it(`locks the account after ${LOCKOUT.maxFailures} failures, even for the right password`, async () => {
    const email = "billing@richfill.test";
    for (let i = 0; i < LOCKOUT.maxFailures - 1; i++) {
      expect(await attemptLogin({ email, password: "wrong", ip: ip() })).toEqual({ ok: false, error: "invalid" });
    }
    expect(await attemptLogin({ email, password: "wrong", ip: ip() })).toEqual({ ok: false, error: "locked" });
    expect(await attemptLogin({ email, password: PASSWORD, ip: ip() })).toEqual({ ok: false, error: "locked" });

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + (LOCKOUT.lockMinutes - 1) * 60_000);
    expect(await prisma.auditLog.count({ where: { userId: user.id, action: "auth.account_locked" } })).toBe(1);

    // After the lock expires the right password works again.
    await prisma.user.update({ where: { email }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect((await attemptLogin({ email, password: PASSWORD, ip: ip() })).ok).toBe(true);
  });

  it(`rate-limits an IP after ${RATE_LIMIT.maxFailuresPerIp} failures`, async () => {
    const attacker = ip();
    for (let i = 0; i < RATE_LIMIT.maxFailuresPerIp; i++) {
      await attemptLogin({ email: `ghost${i}@nowhere.test`, password: "x", ip: attacker });
    }
    expect(await attemptLogin({ email: USERS.rfAdmin, password: PASSWORD, ip: attacker })).toEqual({
      ok: false,
      error: "rate_limited",
    });
    // A different IP is unaffected.
    expect((await attemptLogin({ email: USERS.rfAdmin, password: PASSWORD, ip: ip() })).ok).toBe(true);
  });

  it("records failed logins in the audit log", async () => {
    await attemptLogin({ email: USERS.rfAdmin, password: "wrong", ip: "10.9.9.9" });
    const log = await prisma.auditLog.findFirst({ where: { action: "auth.login_failed", ip: "10.9.9.9" } });
    expect(log).not.toBeNull();
  });
});
