"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { action } from "@/server/action";
import { audit } from "@/server/audit";
import { HttpError } from "@/server/auth/context";
import { switchableCompanies } from "@/server/auth/companies";
import { destroySession, setActiveCompany, SESSION_COOKIE } from "@/server/auth/session";

export const switchCompany = action("company.switch", async (ctx, companyId: string) => {
  const id = z.string().min(1).parse(companyId);
  const target = (await switchableCompanies(ctx)).find((c) => c.id === id);
  if (!target) throw new HttpError(404, "Company not found.");
  await setActiveCompany(ctx.token, target.id);
  await audit({
    ...ctx.auditMeta,
    companyId: target.id,
    action: "auth.company_switch",
    entity: "company",
    entityId: target.id,
    before: { companyId: ctx.company.id },
  });
  return { companyId: target.id };
});

const _logout = action("authenticated", async (ctx) => {
  await destroySession(ctx.token);
  await audit({ ...ctx.auditMeta, action: "auth.logout", entity: "user", entityId: ctx.user.id });
});

export async function logout() {
  await _logout(undefined);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
