import { NextResponse } from "next/server";
import { checkDb } from "@/server/db/health";

export const dynamic = "force-dynamic";

// Public: Railway's healthcheck and the "reconnecting" banner poll this.
export async function GET() {
  const db = await checkDb();
  return NextResponse.json(
    {
      status: db.ok ? "ok" : "degraded",
      db: db.ok ? "up" : "down",
      latencyMs: db.latencyMs,
      time: new Date().toISOString(),
    },
    { status: db.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
