# Operations runbook

## Environments (Railway project "BT Warehouse WMS")

| Environment | Branch    | URL                                      | Database              |
| ----------- | --------- | ---------------------------------------- | --------------------- |
| production  | `main`    | https://bt-wms-production.up.railway.app | Postgres (production) |
| staging     | `staging` | generated staging domain                 | its own Postgres      |

Promote by merging `staging` → `main` after testing on staging.

## Environment variables (app service)

| Variable             | Required         | Value                                                                                               |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | yes              | `${{Postgres.DATABASE_URL}}`                                                                        |
| `NODE_ENV`           | yes              | `production`                                                                                        |
| `DB_POOL_SIZE`       | no               | default 10 (Railway Postgres allows ~100 connections; keep pool × replicas below that)              |
| `DIGEST_WEBHOOK_URL` | no               | POST endpoint for the daily digest (email/WhatsApp gateway). Without it the digest goes to the logs |
| `DIGEST_HOUR`        | no               | IST hour to send the digest, default 8                                                              |
| `CRON_SECRET`        | no               | enables `POST /api/cron/daily` for a Railway cron service; then set `SCHEDULER=off`                 |
| `ERROR_WEBHOOK_URL`  | no               | receives every server error as JSON (Sentry/Slack webhook)                                          |
| `API_RATE_LIMIT`     | no               | API requests per IP per minute, default 600                                                         |
| `SEED_PASSWORD`      | only for seeding | initial password for seeded users                                                                   |

Backup cron service: `DATABASE_URL`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_DEFAULT_REGION`, optional `S3_ENDPOINT`, `KEEP_DAYS`.

## Deploy

- Push to `main` → Railway builds (`npm run build`) and starts (`npm start`): waits for Postgres,
  runs `prisma migrate deploy`, then serves. Healthcheck: `GET /api/health` must return 200.
- Manual deploy from a laptop: `railway up --service BT-WMS --detach`.

## Zero-downtime migrations

Railway keeps the old deployment serving until the new one passes the healthcheck, and migrations run
before the new version serves. So every migration must work with **both** the old and the new code:

1. **Expand**: add new tables / nullable columns / new enum values. Deploy.
2. Ship code that writes both old and new shapes. Deploy.
3. Backfill data with a script (never inside a request).
4. **Contract**: drop old columns in a later release.

Never rename or drop a column in the same release that stops using it. Never edit a migration that has
already run in production; add a new one.

## Rollback

1. Railway → BT-WMS → Deployments → previous successful deployment → **Redeploy** (instant, same image).
2. If the bad release included a migration, it was additive (see above), so the old code still runs.
3. If data was damaged: restore the latest backup into a **new** database (below), verify, then point
   `DATABASE_URL` at it.

## Backups

- `scripts/backup.sh` runs daily as a Railway cron service (`30 20 * * *` = 02:00 IST): `pg_dump --format=custom`,
  verified with `pg_restore --list`, uploaded to S3-compatible storage, 30-day retention.
- Railway also snapshots the Postgres volume; the off-site dump protects against losing the project.

## Restore (tested by `tests/integration/backup.test.ts` in CI)

1. Railway → **+ New → Database → PostgreSQL** (a new, empty database).
2. `./scripts/restore.sh s3://bucket/daily/bt-wms-<stamp>.dump "<new DATABASE_URL>"` — refuses a non-empty target.
3. Compare the printed units per company with the Owner view / last known numbers.
4. Switch the app's `DATABASE_URL` to the restored database and redeploy.

## Incidents

| Symptom                                  | Check                                                           | Fix                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Users see "Reconnecting to the database" | `/api/health` → `db: down`; Railway Postgres metrics            | Wait for Postgres restart (the app reconnects by itself). If down > 5 min, restart the Postgres service |
| Slow pages                               | Railway metrics (CPU/memory), logs `db.retry`                   | Raise `DB_POOL_SIZE` or Postgres plan; run `scripts/explain.mjs`                                        |
| "Too many attempts" at login             | `audit_logs` action `auth.rate_limited` / `auth.account_locked` | Wait 15 min, or an ADMIN resets the user's password (unlocks)                                           |
| Stock looks wrong                        | Stock → Movement ledger for the tile/product                    | Never edit data: post a correcting transfer or a cycle count                                            |
| Daily digest missing                     | logs `job.daily-digest`, table `job_runs`                       | Check `DIGEST_WEBHOOK_URL` and recipients in Company settings                                           |

Logs are JSON lines; search Railway logs by `requestId` from an error screen.
