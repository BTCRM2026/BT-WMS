// Creates a fresh database for this e2e run (never resets an existing one),
// migrates + seeds it, and writes its URL for playwright.config.ts.
// Server: E2E_DB_SERVER_URL (CI) or the local embedded Postgres (`npm run db:local`).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const server = new URL(
  process.env.E2E_DB_SERVER_URL ??
    `postgresql://postgres:postgres@127.0.0.1:${process.env.LOCAL_PG_PORT ?? 54329}/postgres`,
);
const name = `wms_e2e_${Date.now()}`;
const admin = new PrismaClient({ datasourceUrl: server.toString() });
await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
await admin.$disconnect();

const url = new URL(server);
url.pathname = `/${name}`;
const env = { ...process.env, DATABASE_URL: url.toString(), SEED_PASSWORD: "ChangeMe!2026" };
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
writeFileSync(".e2e-db-url", url.toString());
console.log(`e2e database ready: ${name}`);
