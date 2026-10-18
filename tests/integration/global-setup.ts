import { execSync } from "node:child_process";
import net from "node:net";
import { PrismaClient } from "@prisma/client";
import type { TestProject } from "vitest/node";

/**
 * Real Postgres for integration tests. Each run creates its OWN fresh database
 * (wms_test_<timestamp>), applies all migrations, seeds it, and drops it at the
 * end. Existing databases are never reset or touched.
 * Server: TEST_DATABASE_URL (CI service container) or a local embedded Postgres.
 */
const portOpen = (port: number) =>
  new Promise<boolean>((resolve) => {
    const s = net.connect(port, "127.0.0.1", () => (s.destroy(), resolve(true)));
    s.on("error", () => resolve(false));
  });

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  let pg: { stop: () => Promise<void> } | undefined;
  const port = Number(process.env.LOCAL_PG_PORT ?? 54329);
  if (!process.env.TEST_DATABASE_URL && !(await portOpen(port))) {
    // @ts-expect-error plain .mjs helper
    const { startLocalDb } = await import("../../scripts/local-db.mjs");
    pg = await startLocalDb([]);
  }

  const server = new URL(process.env.TEST_DATABASE_URL ?? `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);
  const name = `wms_test_${Date.now()}`;
  const admin = new PrismaClient({ datasourceUrl: server.toString() });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);

  const url = new URL(server);
  url.pathname = `/${name}`;
  const env = { ...process.env, DATABASE_URL: url.toString(), SEED_PASSWORD: "ChangeMe!2026" };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
  project.provide("databaseUrl", url.toString());

  return async () => {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`); // the one this run created
    await admin.$disconnect();
    await pg?.stop();
  };
}
