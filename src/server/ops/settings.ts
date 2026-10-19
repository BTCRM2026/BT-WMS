import { z } from "zod";
import { HttpError, type Context } from "@/server/auth/context";
import { audit } from "@/server/audit";
import type { Tx } from "@/server/stock";

export async function getSettings(db: Context["db"] | Tx, companyId: string) {
  return (
    (await db.companySetting.findUnique({ where: { companyId } })) ?? {
      companyId,
      writeOffApproval: true,
      countApproval: true,
      lockedBefore: null as Date | null,
      digestRecipients: null as string | null,
    }
  );
}

export const settingsSchema = z.object({
  writeOffApproval: z.boolean(),
  countApproval: z.boolean(),
  lockedBefore: z
    .preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date().nullable())
    .refine((d) => !d || d <= new Date(), "The lock date cannot be in the future"),
  digestRecipients: z
    .string()
    .trim()
    .max(500)
    .refine(
      (s) =>
        !s ||
        s
          .split(/[,;\s]+/)
          .filter(Boolean)
          .every((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$|^\+?\d{10,15}$/.test(x)),
      "Use emails or phone numbers separated by commas",
    ),
});

export async function saveSettings(ctx: Context, input: z.input<typeof settingsSchema>) {
  const v = settingsSchema.parse(input);
  const before = await getSettings(ctx.db, ctx.company.id);
  const data = {
    writeOffApproval: v.writeOffApproval,
    countApproval: v.countApproval,
    lockedBefore: v.lockedBefore,
    digestRecipients: v.digestRecipients || null,
  };
  const after = await ctx.db.companySetting.upsert({
    where: { companyId: ctx.company.id },
    update: data,
    create: { companyId: ctx.company.id, ...data },
  });
  await audit({
    ...ctx.auditMeta,
    action: "settings.update",
    entity: "company_settings",
    entityId: after.id,
    before,
    after,
  });
  return { ok: true };
}

/** Soft lock of old periods: refuse to reverse or cancel anything dated before the lock. */
export async function assertOpenPeriod(tx: Tx, companyId: string, when: Date) {
  const s = await getSettings(tx, companyId);
  if (s.lockedBefore && when < s.lockedBefore) {
    throw new HttpError(
      409,
      `This period is locked (before ${s.lockedBefore.toISOString().slice(0, 10)}). Ask the owner to unlock it.`,
    );
  }
}
