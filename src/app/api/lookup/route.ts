import { apiRoute } from "@/server/auth/context";
import { lookupCode } from "@/server/search";

export const GET = apiRoute("stock.view", async (ctx, req) => ({
  result: await lookupCode(ctx, new URL(req.url).searchParams.get("code") ?? ""),
}));
