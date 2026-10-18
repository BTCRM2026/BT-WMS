import { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "@/server/log";

/**
 * The ONE Prisma client for the process (survives Next.js hot reload).
 * App code must not import this directly: use getContext().db, which is
 * tenant-scoped. ESLint blocks imports of this file outside src/server.
 */

// Pool settings suited to Railway Postgres. Values already present in
// DATABASE_URL win, so ops can tune without a deploy.
export function withPoolParams(url: string | undefined): string | undefined {
  if (!url) return url;
  const u = new URL(url);
  const defaults: Record<string, string> = {
    connection_limit: process.env.DB_POOL_SIZE ?? "10",
    pool_timeout: "10", // seconds waiting for a free connection
    connect_timeout: "10", // seconds to open a connection
    socket_timeout: "30", // seconds a single query may run
    max_idle_connection_lifetime: "60", // drop idle sockets (Railway proxy closes them)
  };
  for (const [k, v] of Object.entries(defaults)) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  return u.toString();
}

// Errors where the query never reached the database, so retrying is safe.
const CONNECT_CODES = new Set(["P1001", "P1002", "P2024"]);
// The connection dropped mid-flight (e.g. Railway restart): safe to retry reads only.
const DROPPED_CODES = new Set(["P1017"]);
const READ_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

export function isTransientDbError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  const code = (e as { code?: string })?.code;
  return !!code && (CONNECT_CODES.has(code) || DROPPED_CODES.has(code));
}

function retryable(e: unknown, operation: string): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  const code = (e as { code?: string })?.code;
  if (!code) return false;
  return CONNECT_CODES.has(code) || (DROPPED_CODES.has(code) && READ_OPS.has(operation));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createClient() {
  const base = new PrismaClient({
    datasourceUrl: withPoolParams(process.env.DATABASE_URL),
    log: [{ level: "error", emit: "event" }],
  });
  base.$on("error", (e) => logger.error("prisma", { message: e.message }));

  return base.$extends({
    name: "retry",
    query: {
      async $allOperations({ operation, model, args, query }) {
        const attempts = 4;
        for (let i = 1; ; i++) {
          try {
            return await query(args);
          } catch (e) {
            if (i >= attempts || !retryable(e, operation)) throw e;
            const delay = 200 * 2 ** (i - 1) + Math.floor(Math.random() * 100); // 200, 400, 800ms + jitter
            logger.warn("db.retry", { model, operation, attempt: i, delay, code: (e as { code?: string }).code });
            await sleep(delay);
          }
        }
      },
    },
  });
}

export type BaseClient = ReturnType<typeof createClient>;

const g = globalThis as unknown as { __prisma?: BaseClient };
export const prisma: BaseClient = g.__prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;
