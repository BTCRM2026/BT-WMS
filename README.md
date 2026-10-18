# BT Warehouse WMS

Warehouse management for one physical warehouse shared by two companies,
**Bond Therapy** and **Rich Fill**. Storage addresses are numbered floor tiles.

Stack: Next.js 15 (App Router) + TypeScript, Tailwind CSS, Prisma 6 + PostgreSQL,
bcrypt + httpOnly session cookies, Vitest, Playwright. Deployed on Railway from GitHub.

## Rules the code enforces

| Rule                                               | Where                                                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Every query is filtered by the user's company      | `src/server/db/tenant.ts` (Prisma extension, auto-derived from the schema) + composite `(id, company_id)` foreign keys in the DB       |
| App code cannot use the unscoped client or raw SQL | ESLint `no-restricted-imports` / `no-restricted-syntax` (`eslint.config.mjs`)                                                          |
| Permission map, enforced on the server             | `src/server/auth/permissions.ts`; every API route uses `apiRoute()`, every server action uses `action()` (a test fails if one doesn't) |
| Stock is never an editable number                  | `stock_balance` view over the append-only `stock_movements` table                                                                      |
| `stock_movements` can't be updated/deleted         | DB trigger; fix mistakes with `reverseMovement()`                                                                                      |
| No negative stock, no overselling                  | DB trigger with a per-(product, tile, batch) advisory lock                                                                             |
| Stock changes are atomic and audited               | `recordMovements()` in `src/server/stock.ts` (one transaction, audit rows inside it)                                                   |
| Audit trail                                        | `audit_logs`: who, what, before/after, when, IP, request ID                                                                            |

Tile codes: `<COMPANY>-<ZONE>-<ROW>-<COLUMN>`, e.g. `BT-A-03-1` = Bond Therapy, zone A, row 03, column 1.
Validated in `src/lib/tile.ts` and by a CHECK constraint.

## Local development

```bash
npm install
cp .env.example .env
npm run db:local          # embedded Postgres on :54329, leave running (no Docker needed)
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Seeded logins (password = `SEED_PASSWORD`, default `ChangeMe!2026`):

| Role                                  | Bond Therapy                      | Rich Fill                      |
| ------------------------------------- | --------------------------------- | ------------------------------ |
| SUPER_ADMIN (owner, switches company) | owner@btwarehouse.test            |                                |
| ADMIN                                 | admin@bondtherapy.test            | admin@richfill.test            |
| WAREHOUSE_MANAGER                     | warehousemanager@bondtherapy.test | warehousemanager@richfill.test |
| STORE_KEEPER                          | storekeeper@bondtherapy.test      | storekeeper@richfill.test      |
| BILLING                               | billing@bondtherapy.test          | billing@richfill.test          |
| VIEWER                                | viewer@bondtherapy.test           | viewer@richfill.test           |

## Tests

```bash
npm run test:unit          # permission map, password hashing, tile codes
npm run test:integration   # real Postgres: tenant isolation, roles, lockout, ledger
npm run build && npm run test:e2e   # Playwright against the production server
```

Integration and e2e runs each create their own fresh database (`wms_test_*`, `wms_e2e_*`);
they never reset an existing one. CI (`.github/workflows/ci.yml`) runs lint, typecheck,
unit, integration, build and e2e against a Postgres service on every push and PR.

## Deploying on Railway (GitHub, auto-deploy on `main`)

1. Push this repo to GitHub (`main`).
2. Railway → **New Project** → **Deploy from GitHub repo** → pick the repo. Branch `main`, auto-deploy on.
3. In the project: **+ New → Database → PostgreSQL**.
4. App service → **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference variable; uses the private network)
   - `NODE_ENV` = `production`
   - optional `DB_POOL_SIZE` (default 10)
   - `SEED_PASSWORD` only if you will run the seed (see below)
     Railway sets `PORT` itself; the app listens on it.
5. App service → **Settings → Networking → Generate Domain**.
6. `railway.json` sets the build (`npm run build`), start (`npm start`) and healthcheck (`/api/health`).
   `npm start` waits for the database, runs `prisma migrate deploy` (applies pending migrations only, never resets),
   then starts Next.js.
7. First time only, load the companies/tiles/users: Railway app service → **⋯ → Run command**
   (or `railway run npm run db:seed` from your PC). Then sign in and change every password.

`GET /api/health` returns `200 {"status":"ok","db":"up"}` or `503` when the database is unreachable.

## Layout

```
prisma/            schema, migrations (incl. integrity SQL), seed
scripts/           start.mjs (Railway entrypoint), local-db.mjs (embedded Postgres)
src/server/        db client + tenant layer, auth, permissions, audit, stock service
src/app/           pages (login, dashboard, modules), server actions, API routes
src/lib/           shared helpers (tile codes, navigation)
tests/unit         tests/integration         e2e/
```
