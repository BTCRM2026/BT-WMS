import { prisma } from "@/server/db/client";
import type { Context } from "./context";

/** Companies the user may act for: all of them for roles with company.switch, else their own. */
export async function switchableCompanies(ctx: Context) {
  if (!ctx.can("company.switch")) return [ctx.company];
  return prisma.company.findMany({ orderBy: { name: "asc" } });
}
