import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/server/db/client";

export const SESSION_COOKIE = "wms_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // one working day

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  expires,
});

/** Only the SHA-256 of the token is stored, so a DB leak does not leak live sessions. */
export async function createSession(userId: string, companyId: string, ip?: string, userAgent?: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: { tokenHash: sha256(token), userId, activeCompanyId: companyId, ip, userAgent, expiresAt },
  });
  return { token, expiresAt };
}

export async function loadSession(token: string) {
  const s = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { company: true } }, activeCompany: true },
  });
  // (Password changes delete all of a user's sessions, see change-password.ts.)
  if (!s || s.expiresAt < new Date() || !s.user.isActive) return null;
  return s;
}

export async function destroySession(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function setActiveCompany(token: string, companyId: string) {
  await prisma.session.update({ where: { tokenHash: sha256(token) }, data: { activeCompanyId: companyId } });
}
