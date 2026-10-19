import type { Tx } from "@/server/stock";

/**
 * Transaction-scoped advisory locks: concurrent transactions that touch the same
 * keys (e.g. one product's allocation, one sales order's dispatch) run one after
 * another instead of both reading the same "available" number.
 * Keys are sorted so two transactions never deadlock on each other.
 */
export async function lockKeys(tx: Tx, keys: string[]) {
  for (const k of [...new Set(keys)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${k}, 1))`;
  }
}
