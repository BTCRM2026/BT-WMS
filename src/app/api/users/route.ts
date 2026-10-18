import { apiRoute } from "@/server/auth/context";

export const GET = apiRoute("users.view", async ({ db }) => ({
  items: await db.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, lockedUntil: true },
    orderBy: { name: "asc" },
  }),
}));
