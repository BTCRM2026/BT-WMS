# User manual

Sign in at the company URL with your email and password. You land on your company's dashboard.
Phones show a bottom bar (Dashboard, Stock, **Scan**, Floor map, More); desktops show the left menu.
Every code field (tile, product, batch) has a camera button; USB scanners work in any field.

## Owner (SUPER_ADMIN)

Switch company with the building button in the top bar. **Owner view** compares both companies.
**Reports** has 13 reports with date filters and Excel / PDF export. **Company settings** holds
approval rules, the period lock, the receiving warning time (hours, default 4), digest recipients and the
full data export.

![Owner dashboard](manual/owner-dashboard.png)
![Owner view](manual/owner-owner.png)
![Reports](manual/owner-reports-report-valuation.png)
![Company settings](manual/owner-settings-company.png)

## Admin

Manages **Users** (create, change role, reset password, deactivate), **Products** (edit, import from
Excel/CSV with a row-by-row check; optional **Max boxes per tile** for big cartons), **Tiles** (create,
bulk-generate with a capacity in boxes per level, **Set capacity** in bulk, print, deactivate) and reads
the **Audit log**.

![Users](manual/admin-users.png)
![Products](manual/admin-products.png)
![New tiles](manual/admin-locations-new.png)
![Audit log](manual/admin-audit-log.png)

## Warehouse manager

Creates **purchase orders**, records **receipts** (good, damaged, short, batch, expiry, photos),
approves **write-offs** and **cycle counts**. With **Put away now** (default) each receipt line shows the
suggested tile(s), split by box capacity; edit or scan them and the good cartons go straight to the tiles
when the receipt is posted. Untick it to leave everything for the putaway queue. Cartons that arrived
damaged: **Inward receipts → Damaged on arrival → Write off damaged**.
Sets up the floor in **Locations → Rooms**: add a room, go inside, **Add row** for each row of tiles,
**Leave room** to go back (see [TILES.md](TILES.md)).

![Purchase orders](manual/manager-purchase-orders.png)
![Inward receipts](manual/manager-inward.png)
![Write-offs](manual/manager-damages.png)
![Stock audits](manual/manager-stock-audits.png)

## Store keeper (phone)

1. **Putaway**: the suggested tile(s) and quantities are filled in (split over tiles when one is not
   enough). Scan the tile you actually used if different, fix the quantity, Confirm. Stock becomes
   pickable; anything you did not place stays in the queue.
2. **Pick lists**: walk the route top to bottom, scan each tile, confirm the quantity. Fewer than asked?
   Enter what you picked and a reason.
3. Pack, then **Confirm dispatch** with vehicle and LR numbers; print the challan.
4. **Transfers**, **Returns** and **Stock audits** (counting) are in the menu.

![Scan](manual/storekeeper-scan.png)
![Putaway](manual/storekeeper-inward-putaway.png)
![Pick lists](manual/storekeeper-picking.png)
![Floor map](manual/storekeeper-locations-map.png)

## Billing

Enters **sales orders**, follows them to dispatch, prints challans.

![Sales orders](manual/billing-sales-orders.png)
![New sales order](manual/billing-sales-orders-new.png)
![Dispatch](manual/billing-dispatch.png)

## Viewer

Read-only: dashboard, stock, ledger, reports.

![Dashboard](manual/viewer-dashboard.png)
![Stock](manual/viewer-stock.png)
![Ledger](manual/viewer-stock-ledger.png)

## Rules everyone should know

- Stock is never typed in. It changes only through receipts, putaway, dispatch, transfers, returns,
  write-offs and counts, and every change is in the ledger.
- Mistakes are not deleted: cancel the dispatch or post a correcting transfer / count.
- Double-tapping a button is safe; it saves once.
- If the yellow "Reconnecting" bar shows, wait: the app reconnects by itself and nothing is lost.
