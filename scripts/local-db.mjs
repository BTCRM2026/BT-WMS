// Local Postgres for development and tests, no Docker or system install needed.
// Usage: `npm run db:local` (keeps running). Tests import startLocalDb().
// CI uses a real Postgres service instead (see .github/workflows/ci.yml).
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const LOCAL_PORT = Number(process.env.LOCAL_PG_PORT ?? 54329);
export const localUrl = (db) => `postgresql://postgres:postgres@127.0.0.1:${LOCAL_PORT}/${db}`;

export async function startLocalDb(databases = ["wms", "wms_test"]) {
  const dir = path.join(root, ".local-db");
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port: LOCAL_PORT,
    persistent: true,
    onLog: () => {},
  });
  if (!existsSync(path.join(dir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  for (const db of databases) await pg.createDatabase(db).catch(() => {}); // exists already
  return pg;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const pg = await startLocalDb();
  console.log(`Local Postgres running. DATABASE_URL=${localUrl("wms")}`);
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
