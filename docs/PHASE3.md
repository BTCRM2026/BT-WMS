# Phase 3: core warehouse modules

## What was built

| Module          | Screens                                                                                                                                                                 | Rules enforced on the server                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products        | List, create/edit, activate/deactivate, CSV/Excel import with row-by-row preview                                                                                        | SKU `A-Z 0-9 -`, 3-32 chars, unique per company; barcode unique; max ≥ min; import commits only when every row is valid                                                                                                      |
| Tiles           | Table, floor map (zones, rows, columns, level tabs), single + bulk generate (e.g. zone BT, rows A-F, columns 1-20, levels 1-3), printable tile map, activate/deactivate | Zone must start with the company code; no deactivating or renaming a tile that holds stock                                                                                                                                   |
| Users           | List, create/edit (ADMIN)                                                                                                                                               | No SUPER_ADMIN creation; cannot demote/deactivate yourself; password rules; sessions revoked on password change/deactivation                                                                                                 |
| Purchase orders | List, create, detail with received vs ordered                                                                                                                           |                                                                                                                                                                                                                              |
| Inward          | Receive against a PO or direct: batch, mfg, expiry, good / damaged / short, damage photos                                                                               | Good units → RECEIVING tile (not pickable), damaged → DAMAGED tile, short recorded; batch + expiry required for expiry-tracked products; photos checked by content type, 2 MB max                                            |
| Putaway         | Phone-first queue with suggested tile, scan/type tile, confirm                                                                                                          | Suggestion: product's default tile, else nearest free tile in the company's zones; only STORAGE tiles of the same company; capacity check; stock pickable only after putaway (TRANSFER_OUT + TRANSFER_IN in one transaction) |
| Stock           | Per tile / batch view, expiry status, movement ledger by product or tile, "what is on this tile" sheet                                                                  | Every number comes from `stock_movements`                                                                                                                                                                                    |
| Sales orders    | List, create, detail (ordered / on pick list / picked / dispatched), cancel                                                                                             |                                                                                                                                                                                                                              |
| Picking         | Phone-first pick route, scan tile, confirm qty, short-pick reason                                                                                                       | FEFO allocation, expired stock never allocated, reserved stock not double-promised (per-product locks), wrong tile refused                                                                                                   |
| Dispatch        | Packing check, vehicle / LR / transporter, challan PDF, partial dispatch, cancel dispatch                                                                               | Stock leaves only at dispatch (OUTWARD); dispatch per order is serialised; cancel = reversing entries                                                                                                                        |
| Transfers       | Tile to tile with reason                                                                                                                                                | Both sides in one transaction                                                                                                                                                                                                |
| Returns         | Receive to RETURN tile, inspect: restock / damage / send back                                                                                                           | Damage disposition needs manager approval                                                                                                                                                                                    |
| Write-offs      | Damage / expiry, approve or reject                                                                                                                                      | Approval requires `stock.approve` (WAREHOUSE_MANAGER and above)                                                                                                                                                              |
| Cycle counts    | Create for tiles, enter counts, variance, submit, approve                                                                                                               | Every variance needs a reason; approval posts ADJUSTMENT movements                                                                                                                                                           |

Every write is idempotent: forms send a one-time key, so double clicks, retries and two tabs
submitting the same form create one record (`idempotency_keys`, `once()` in `src/server/ops/core.ts`).

Tile codes now read `ZONE-ROW-COLUMN-LEVEL` (BT-A-03-1 = zone BT, row A, column 03, level 1),
matching the bulk generator. Existing tiles were re-read from their codes by the migration.

## Tests

- Unit (56): FEFO, putaway suggestion, variance, tile codes, permissions, passwords.
- Integration on real Postgres (183): full inward → putaway → order → pick → dispatch cycle with
  exact stock at every step, cancel/partial dispatch, transfer atomicity with a forced failure mid-way,
  two simultaneous pick lists and two simultaneous dispatches for the last 10 units (one wins),
  duplicate submits, expired stock never picked, returns, write-off and count approvals by role,
  cross-company access on every table and every API route, bad import files (missing columns,
  duplicates, wrong types, wrong file type, oversize).
- E2E: a full day for each company through the UI (PO, receive, putaway, order, FEFO pick, pack,
  dispatch + challan PDF, ledger, transfer, return, cycle count with manager approval); STORE_KEEPER
  cannot approve; VIEWER cannot edit; every screen at 360/768/1280/1920 + iPhone Safari + Edge/Firefox;
  axe WCAG AA on the new screens.
- Coverage (unit + integration, `npm run test:coverage`): 72% of lines in `src/server` and `src/lib`;
  the operations modules are 89-100%. Pages, search, insights and the challan are covered by e2e.

## Known limits

- Cycle counts list what the system expects on each tile; a product found on a tile with no system
  stock is recorded with a transfer or a receipt, not inside the count.
- The challan PDF fits about 30 lines on one page.
- Product and tile lists page in the browser (fine for hundreds of SKUs / tiles).
