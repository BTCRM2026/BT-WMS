import { apiRoute } from "@/server/auth/context";

export const GET = apiRoute("locations.view", async ({ db }) => ({
  items: await db.location.findMany({ orderBy: { code: "asc" }, take: 500 }),
}));
