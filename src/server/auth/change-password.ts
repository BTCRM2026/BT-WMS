import { prisma } from "@/server/db/client";
import { audit } from "@/server/audit";
import type { Context } from "./context";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import { createSession } from "./session";

export async function changePassword(ctx: Context, current: string, next: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "Current password is incorrect." };
  const problem = validatePassword(next);
  if (problem) return { error: problem };
  if (current === next) return { error: "New password must be different." };

  const changedAt = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(next), passwordChangedAt: changedAt },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }), // sign out everywhere
  ]);
  await audit({ ...ctx.auditMeta, action: "auth.password_changed", entity: "user", entityId: user.id });
  return createSession(user.id, ctx.company.id, ctx.ip, ctx.userAgent);
}
