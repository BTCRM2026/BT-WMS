import { apiRoute } from "@/server/auth/context";

export const GET = apiRoute("dashboard.view", async (ctx) => ({
  user: ctx.user,
  company: { id: ctx.company.id, name: ctx.company.name, slug: ctx.company.slug },
}));
