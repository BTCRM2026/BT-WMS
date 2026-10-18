import { prisma } from "./client";

/** SELECT 1 with a hard 3s cap so a hung DB cannot hang the healthcheck. */
export async function checkDb(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
