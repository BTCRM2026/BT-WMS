import { NextResponse, type NextRequest } from "next/server";

// Cheap edge check only (cookie present). The real session check runs on the
// server in getContext(); this just saves a round-trip for logged-out users.
const PUBLIC = ["/login", "/api/health", "/api/cron"];

// ponytail: per-instance memory; move to Redis/Postgres if Railway runs several replicas.
const hits = new Map<string, { n: number; reset: number }>();
const LIMIT = Number(process.env.API_RATE_LIMIT ?? 600); // API requests per IP per minute

function rateLimited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 60_000 });
    if (hits.size > 50_000) hits.clear();
    return false;
  }
  return ++h.n > LIMIT;
}

export function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const { pathname: path } = req.nextUrl;

  if (path.startsWith("/api/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (rateLimited(ip))
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": "60" } });
    // CSRF: state-changing API calls must come from this site (server actions get Next's own origin check).
    const origin = req.headers.get("origin");
    const sameSite = (() => {
      try {
        return !!origin && new URL(origin).host === req.headers.get("host");
      } catch {
        return false;
      }
    })();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !path.startsWith("/api/cron") && !sameSite) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }
  }
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);

  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isPublic && !req.cookies.has("wms_session")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401, headers: { "x-request-id": requestId } });
    }
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg|brands/|robots.txt).*)"],
};
