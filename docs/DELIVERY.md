# BT Warehouse WMS: foundation + UI redesign, delivery report

Live app: https://bt-wms-production.up.railway.app (health: `/api/health`)
Repo: https://github.com/BTCRM2026/BT-WMS (branch `main`, Railway auto-deploys every push)

## Test results

| Suite                                                                                                                                                                                                  | Where      | Result                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------- |
| Unit (permission map, password hashing, tile codes)                                                                                                                                                    | local + CI | 32 / 32 passed                                                       |
| Integration on real Postgres (tenant isolation on every table and every API route, roles, lockout, rate limit, append-only ledger, no negative stock, concurrency)                                     | local + CI | 147 / 147 passed                                                     |
| E2E Playwright: login per company, wrong password, blocked URLs, sign-out, dark mode, all main screens at 360/768/1280/1920, iPhone Safari (WebKit), Edge (local) / Firefox (CI), table/map/scan flows | local + CI | 51 passed, 4 skipped (phone-only touch-target check on wide screens) |
| Axe WCAG 2.1 AA, light + dark, 360 + 1280, every main screen                                                                                                                                           | local + CI | 0 serious, 0 critical                                                |
| DB outage: proxy drops Postgres, app shows friendly screens and recovers by itself                                                                                                                     | local + CI | passed                                                               |
| Lighthouse CI (desktop): login, dashboard, products, floor map, stock, scan                                                                                                                            | CI         | all ≥ 90 Performance / Accessibility / Best Practices                |
| Lint + typecheck                                                                                                                                                                                       | local + CI | clean                                                                |

## Railway environment variables (app service `BT-WMS`)

| Variable       | Value                                                     | Set? |
| -------------- | --------------------------------------------------------- | ---- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference, private network) | ✓    |
| `NODE_ENV`     | `production`                                              | ✓    |
| `DB_POOL_SIZE` | `10` (optional)                                           | ✓    |
| `PORT`         | set by Railway automatically, do not set                  | —    |

`SEED_PASSWORD` is only needed if the seed is run again. The production seed was run once with a random
password, saved on your PC in `D:\BT Warehouse\.seed-credentials.txt` (git-ignored, never pushed).
Sign in as `owner@btwarehouse.test` with it, then change every seeded user's password.

## Design decisions

See [DESIGN.md](DESIGN.md). In short: tokens in one file, deep-blue primary + slate neutrals + semantic
green/amber/red/blue, per-company accent and logo, Inter, 8px grid, 150–200ms motion; shadcn-style
components on Radix; bottom nav and cards on phones, icon rail on tablets, collapsible sidebar on desktop;
tables with sort/filter/columns/pagination/CSV/saved views; colour-plus-number floor map; camera + USB scan;
one shared Prisma client with pool limits, retry with backoff, pool reset after a dropped connection,
DB wait at startup, friendly error screens and a reconnecting banner; all text in `messages/en.json`.

## Screenshots

`docs/screenshots/before/` and `docs/screenshots/after/`: login, dashboard, products, locations, stock
(+ floor map and scan in "after") at 360, 768, 1280 and 1920 px.

## Known limits / next steps

- CSV export opens in Excel; a native `.xlsx` export is planned with the reports phase.
- Pick, putaway and cycle-count buttons on the Scan screen are placeholders until the modules phase.
- Tables page on the client (fine for today's ~85 SKUs, 90 tiles); switch to server paging as data grows.
- Firefox runs in CI only: Windows Smart App Control blocks Playwright's unsigned Firefox on this PC.
- Railway marks `railway.json` (config-as-code) deprecated from 2026-12-01; migrate to `.railway/railway.ts` before then.
