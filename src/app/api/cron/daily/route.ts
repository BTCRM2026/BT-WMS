import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDailyDigest } from "@/server/alerts";

export const dynamic = "force-dynamic";

// For a Railway cron service: POST with header x-cron-secret: $CRON_SECRET. Runs at most once per day.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await runDailyDigest());
}
