// Production entrypoint (Railway): wait for Postgres, apply migrations, then serve.
// `prisma migrate deploy` only applies pending migrations; it never resets data.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const port = process.env.PORT || "3000";
const MAX_WAIT_MS = Number(process.env.DB_WAIT_MS ?? 120_000);

const prismaBin = require.resolve("prisma/build/index.js");
const nextBin = require.resolve("next/dist/bin/next");
const log = (msg, extra = {}) =>
  console.log(JSON.stringify({ level: "info", msg, time: new Date().toISOString(), ...extra }));

const started = Date.now();
for (let attempt = 1, delay = 1000; ; attempt++, delay = Math.min(delay * 2, 15_000)) {
  const r = spawnSync(process.execPath, [prismaBin, "migrate", "deploy"], { stdio: "inherit" });
  if (r.status === 0) break;
  if (Date.now() - started > MAX_WAIT_MS) {
    log("startup.db_unavailable", { attempt });
    process.exit(1);
  }
  log("startup.waiting_for_db", { attempt, retryInMs: delay });
  await new Promise((res) => setTimeout(res, delay));
}

log("startup.serving", { port });
const app = spawn(process.execPath, [nextBin, "start", "-p", port, "-H", "0.0.0.0"], { stdio: "inherit" });
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => app.kill(sig));
app.on("exit", (code) => process.exit(code ?? 0));
