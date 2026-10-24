# BT Warehouse WMS: the complete guide

This guide explains every part of the BT Warehouse system in plain language: what each module is for,
how to use it step by step, and what to do when real things go wrong on the floor. Every example uses
the way the system actually behaves today.

---

## Contents

1. [The big picture](#1-the-big-picture)
2. [Five rules the system never breaks](#2-five-rules-the-system-never-breaks)
3. [Who can do what (roles)](#3-who-can-do-what-roles)
4. [Getting around: sign-in, dashboard, scan, search](#4-getting-around-sign-in-dashboard-scan-search)
5. [Masters: Products, Tiles, Labels](#5-masters-products-tiles-labels)
6. [Inward: Purchase orders, Receiving, Putaway](#6-inward-purchase-orders-receiving-putaway)
7. [Inventory: Stock, Ledger, Transfers, Stock audits, Adjustments](#7-inventory-stock-ledger-transfers-stock-audits-adjustments)
8. [Outward: Sales orders, Picking, Packing, Dispatch](#8-outward-sales-orders-picking-packing-dispatch)
9. [Returns and Damages (write-offs)](#9-returns-and-damages-write-offs)
10. [Reports, Owner view and the daily digest](#10-reports-owner-view-and-the-daily-digest)
11. [Admin: Users, Audit log, Company settings](#11-admin-users-audit-log-company-settings)
12. [A full day in the warehouse, start to finish](#12-a-full-day-in-the-warehouse-start-to-finish)
13. [Situation handbook: "if this happens, do this"](#13-situation-handbook-if-this-happens-do-this)
14. [Daily, weekly and monthly habits](#14-daily-weekly-and-monthly-habits)
15. [Glossary](#15-glossary)

---

## 1. The big picture

One physical warehouse is shared by **two companies: Bond Therapy (code BT) and Rich Fill (code RF)**.
The WMS keeps their stock, people and paperwork completely separate, even though the goods sit under
the same roof.

Every storage spot on the floor is a numbered **tile**, for example `BT-A-03-1`. The system always knows
which product, which batch and how many units sit on which tile.

Goods flow through the warehouse like this:

```
 Purchase order ──► Receive (GRN) ──► Receiving tile ──► Putaway ──► Storage tile
                                                                         │
 Customer ◄── Dispatch (challan) ◄── Packing check ◄── Pick list (FEFO) ◄┘
     │
     └──► Return ──► Return tile ──► Inspect ──► Restock / Write-off / Send back
```

With **Put away now** (the default when receiving), Receive and Putaway happen in one step: good cartons
go straight from the truck to their storage tiles.

Inside the warehouse you can also **move** stock between tiles (transfers), **count** it (stock audits)
and **write off** damaged or expired units (damages).

---

## 2. Five rules the system never breaks

Understanding these five rules explains almost every message the system shows you.

1. **Stock is never typed in.** Nobody can open a screen and change "50" to "48". Stock changes only
   through a real event: a receipt, a putaway, a pick and dispatch, a transfer, a return, a write-off or
   an approved count. Each event writes a line in the **movement ledger**, and the stock figure is
   always the sum of those lines.
2. **Nothing is deleted.** A mistake is fixed by a correcting entry (cancel a dispatch, post a
   transfer, approve a count). The original entry stays, so you can always see what happened.
3. **Stock can never go negative.** The database itself refuses any movement that would take a tile
   below zero, so you can never dispatch or transfer units that are not there.
4. **The two companies never mix.** A Bond Therapy user cannot see Rich Fill data, and Bond Therapy
   stock can only go on tiles whose zone starts with `BT`. Rich Fill stock only on `RF…` zones.
5. **Every action is recorded.** Who did it, what changed (before and after), when, and from which
   device. The owner and admin can read it in the **Audit log**.

Two more things that make daily life easier:

- **Double-tapping is safe.** If a button is pressed twice, or the network retries, the action is saved
  only once.
- **Losing the connection is safe.** If a yellow "Reconnecting" bar appears, wait. The app reconnects by
  itself and no entry is lost. Unsaved form entries are kept if you refresh.

---

## 3. Who can do what (roles)

| Role | Typical person | What they can do |
| --- | --- | --- |
| **Owner (Super Admin)** | Business owner | Everything, in both companies. Switches company, sees the Owner view, changes company settings. |
| **Admin** | Office head / IT person | Everything inside their own company: users, products, tiles, labels, audit log, settings. Cannot switch company. |
| **Warehouse manager** | Warehouse in-charge | Purchase orders, receiving, putaway, picking, dispatch, transfers, returns, counts, and **approving** write-offs and cycle counts. Manages products and tiles. |
| **Store keeper** | Floor staff, usually on a phone | Putaway, picking, packing, dispatch, transfers, returns, counting. **Cannot approve** write-offs or counts. |
| **Billing** | Accounts / order desk | Creates sales orders and purchase orders, follows them to dispatch, prints challans, runs reports. Does not move stock. |
| **Viewer** | Auditor, partner, accountant | Read only: dashboard, stock, ledger, reports. Cannot change anything. |

If someone tries to open a screen their role does not allow, they see a "not allowed" page. This is
enforced on the server, so hiding a button is not the only protection.

**Example.** Ramesh is a store keeper. He finds 5 broken bottles and reports a write-off. The stock
does **not** drop yet. It drops only when the warehouse manager approves it. This stops one person from
quietly removing stock.

---

## 4. Getting around: sign-in, dashboard, scan, search

### Signing in

1. Open the company link and enter your email and password.
2. After several wrong passwords the account is locked for a short time. This protects against guessing.
3. Change your own password under **Settings → Password** (at least 10 characters with upper case, lower
   case and a number).

The **owner** has a building button in the top bar to switch between Bond Therapy and Rich Fill.

### Phone vs desktop

- **Phone:** a bottom bar with Dashboard, Stock, **Scan**, Floor map and More.
- **Desktop:** a left menu grouped as Masters, Inventory, Inward, Outward and Admin.
- Every field that takes a code (tile, product, batch) has a **camera button**. USB barcode scanners also
  work in any field: they type the code and press Enter.

### Dashboard

The first screen after sign-in. It shows the company's live position:

| Tile on dashboard | What it tells you |
| --- | --- |
| Inward today / Outward today | Units received and dispatched today |
| Awaiting putaway | Units received but still sitting on the receiving tile |
| Open pick lists | Picking work not finished yet |
| Active SKUs / Units in stock | Size of the catalogue and total stock |
| Below minimum | Products under their minimum stock level |
| Expiring in 90 days | Units that will expire soon |
| Tiles in use | How full the floor is |

Below that: an **Inward vs outward** chart for the last 30 days, **Stock by zone**, an **Expiry timeline**
for the next 12 months, and an **Alerts** list.

**Early warning.** If goods sit on the receiving tile longer than the company's limit (Company settings,
default **4 hours**), a yellow card at the top of the dashboard says so: "Goods on the receiving tile for
over 4 h: 240 units on 3 receipt lines". Tap it to open the putaway queue.

**Example.** At 10 am the manager sees "Awaiting putaway: 240". That means yesterday's truck was received
but not shelved. Those units cannot be picked for orders until they are put away, so the manager sends a
store keeper to clear the putaway queue first.

### Scan

The fastest way to answer "what is this?". Point the camera at any barcode or QR (or type the code):

- Scan a **product** barcode or SKU → see the product and its stock.
- Scan a **tile** label → see exactly what is on that tile.
- Scan a **batch** number → see where that batch is and how much is left.

Shortcut buttons on the Scan screen take you straight to Pick lists, Putaway and Stock audits.

**Example.** A carton is lying in the aisle with no paperwork. Scan its barcode: the system shows the
product, and the Stock screen shows which tiles normally hold it, so you know where it belongs.

### Search

The search box in the top bar finds products, tiles, batches, purchase orders and sales orders from one
place. Other documents (GRNs, pick lists, challans, returns, write-offs, counts) are found with the search
box on their own list screen.

### Tables

Every list (products, stock, orders…) can be sorted, filtered, searched, have columns hidden, be saved
as a **saved view** ("My low stock view"), and be exported to CSV that opens in Excel.

---

## 5. Masters: Products, Tiles, Labels

Masters are the "setup" data everything else depends on. Get them right once and the daily work becomes
easy.

### 5.1 Products

**What it does.** Keeps the catalogue of everything the company stores.

Each product has:

| Field | Meaning | Example |
| --- | --- | --- |
| SKU | Unique code, 3 to 32 characters, A-Z, 0-9 and dashes | `BT-OIL-500` |
| Name, Unit, Pack size | What it is and how it is counted | "Massage oil 500 ml", Bottle, 12 per carton |
| Barcode | Printed barcode, unique | 8901234567890 |
| Min stock / Max stock | Reorder level and ceiling (max must be ≥ min) | 100 / 1000 |
| Track batches and expiry | Turn on for anything with an expiry date | On for oils, creams, medicines |
| Default tile | Its "home" tile, suggested first at putaway | `BT-A-03-1` |
| Max boxes per tile | Optional. For big cartons: at most this many boxes of this product fit on one tile. Empty = only the tile's capacity counts | Big tissue carton: 4; small serum carton: leave empty |
| MRP, Purchase price | Used for stock valuation reports | ₹450, ₹280 |

**How to add one product**

1. Go to **Products → New**.
2. Fill in SKU, name, unit, pack size, barcode.
3. Set min and max stock.
4. Tick **Track batches and expiry** if the product has an expiry date.
5. Choose a default tile (optional but recommended). For a bulky product, set **Max boxes per tile**.
6. Enter MRP and purchase price, then **Save**.

**How to import many products from Excel**

1. **Products → Import**, then **Download CSV template**.
2. Fill the template in Excel and save it as .csv or .xlsx (max 2 MB). The column `max_boxes_per_tile`
   is optional; leave it empty for normal products.
3. Upload it and press **Check file**. Every row is checked and you see a preview: which rows are new,
   which are updates, and which have problems (bad SKU, duplicate barcode, missing column, wrong number).
4. Fix the problem rows in Excel and upload again.
5. Only when **every** row is clean does **Import N products** become possible. Nothing is half-imported.

**Deactivating.** A product you no longer stock can be deactivated. It disappears from new orders but
its history stays.

> **Situation: "We imported 300 products and 4 rows had a wrong barcode."**
> Nothing was saved. The preview tells you exactly which 4 rows and why. Fix them, upload again, and all
> 300 go in together. You never end up with 296 products and a mess to clean up.

> **Situation: "Our oil keeps running out before we notice."**
> Set its **Min stock**. When stock falls under it, the product shows as "Low stock", it appears in the
> dashboard's "Below minimum" count, and it goes into the next daily digest.

### 5.2 Locations / Tiles

**What it does.** Defines every storage spot on the floor and shows a live **floor map**.

**Reading a tile code**

```
BT - A - 03 - 1
│    │   │    └─ LEVEL   1 = floor; 2, 3 … if pallets are stacked
│    │   └────── COLUMN  2 digits, counted from the entrance wall (01, 02 … 20)
│    └────────── ROW     letter, counted from the dispatch side (A, B, C …)
└─────────────── ZONE    starts with the company code: BT… Bond Therapy, RF… Rich Fill
```

**Tile types**

| Type | Purpose | Example |
| --- | --- | --- |
| Storage | Normal shelving; the only type that is pickable | `BT-A-03-1` |
| Receiving | Where good units land when a truck is unloaded | `BTX-R-01-1` |
| Dispatch | Staging area for outgoing goods | `BTX-D-01-1` |
| Damaged | Damaged units waiting for a decision | `BTX-X-01-1` |
| Quarantine | Units on hold | `BTX-Q-01-1` |
| Return | Customer returns waiting for inspection | `BTX-RT-01-1` |

**Capacity is counted in boxes (cartons).** A tile "holds 5 boxes", whatever is in them. The system turns
units into boxes with the product's pack size (units per carton, a part carton counts as one box). Each
level is its own tile (`BT-A-03-1`, `BT-A-03-2`), so every level can have its own capacity.

The room a product has on a tile is: the smaller of **tile capacity** and the product's **max boxes per
tile**, minus the boxes already on the tile. Example: tile capacity 12 boxes, 5 boxes already on it, a
big product with max 4 boxes per tile: no room (4 − 5). A small product without a limit: 7 boxes of room.
A tile without a capacity is unlimited; the floor map marks it with a yellow **?** ("capacity not set")
so you remember to fill it in.

**How to create tiles in bulk (recommended)**

1. **Locations → New tile → Generate tiles**.
2. Enter zone `BT`, rows `A-F`, columns 1 to 20, levels 1 to 3.
3. Enter **Capacity per level (boxes)**, for example level 1 = 3, level 2 = 5, level 3 = 5. (Or one
   number in "Capacity (boxes, all levels)".)
4. The screen shows "360 tiles: BT-A-01-1 … BT-F-20-3". Press generate. Existing codes are skipped, so
   running it again is harmless.

**How to set capacity on tiles you already have**

- **Many tiles:** **Locations → Set capacity**. Choose the zone, rows (`A-F`), columns (from-to) and
  levels (from-to), enter the boxes and press **Set capacity**. Every matching tile of your company is
  updated, and the change is in the audit log. Leave the boxes empty to clear the capacity.
- **Some tiles from the list:** tick them in the Locations table, enter the boxes in the bar that appears
  and press **Set capacity**.
- **One tile:** tap it (table or floor map) and change **Capacity (boxes)** at the bottom.

**Floor map.** **Locations → Floor map** draws every zone, row and column. Each tile shows **boxes used /
capacity** (for example `3/5`) and a colour for how full it is. Use the level tabs to see stacked levels.
Tap a tile to see what is on it.

**Printing.** **Locations → Print tile map** gives a paper map to stick on the wall.

**Safety rules.** You cannot deactivate or rename a tile that still holds stock (move the stock first),
and you cannot create a Bond Therapy tile in an RF zone.

> **Situation: "We are adding a new rack at the back."**
> Generate tiles for the new zone (for example `BT2`, rows A-C, columns 1-10), print labels, stick them,
> and the new tiles appear on the floor map and in putaway suggestions right away. Give them a capacity
> per level while generating, so putaway knows how many boxes fit.

> **Situation: "We gave level 2 a capacity of 3 boxes, but it really takes 5."**
> Locations → Set capacity → zone `BT`, rows `A-F`, columns 1-20, levels 2 to 2 → 5 boxes → Set capacity. Tiles that already hold more than the new capacity keep their stock; putaway just stops adding
> to them.

> **Situation: "A Rich Fill carton was almost shelved in Bond Therapy's row."**
> The system refuses: a Rich Fill user cannot even pick a `BT…` tile, and putaway only accepts tiles of
> the user's own company.

### 5.3 Labels

**What it does.** Prints barcode or QR labels for **tiles, products, batches and cartons**.

1. Go to **Labels** and choose what to print for (Tiles, Products, Batches or Cartons).
2. Filter and select the items (or **Select all**).
3. Choose paper: **A4 sheet (3 × 8)** for an office printer, or **50 × 25 mm** for a label printer.
4. Choose code type (Automatic is fine) and press **Print**.

Stick tile labels on the floor at the front-left corner of each tile, plus one at eye level on the
nearest pillar for each row.

> **Situation: "A tile label got torn by a forklift."**
> Labels → Tiles → filter for that tile code → print one label. Two minutes.

---

## 6. Inward: Purchase orders, Receiving, Putaway

### 6.1 Purchase orders (PO)

**What it does.** Records what you **expect** to receive, so you can compare it with what actually
arrives.

1. **Purchase orders → New purchase order**.
2. Enter the supplier, the expected date and the lines (product + quantity).
3. Save. The PO shows **Ordered**.
4. As goods arrive, the PO detail shows **Ordered vs Received** per line, and the status moves to
   **Partly received** or **Received**.

> **Situation: "The supplier says they sent everything, we think 2 cartons are missing."**
> Open the PO: it shows ordered 500, received 476, and the GRN shows "short 24". That is your proof.

### 6.2 Inward receipts (GRN): receiving the truck

**What it does.** Records what **actually arrived**, line by line, split into good, damaged and short.

**Step by step**

1. **Inward receipts → Receive goods** (or open the PO and press **Receive goods**; the lines are filled
   in for you). You can also receive without a PO ("direct receipt").
2. For each line, enter:
   - **Good**: units in sellable condition.
   - **Damaged**: broken, leaking or crushed units.
   - **Short**: units on the invoice that did not arrive.
   - **Batch number, Mfg date, Expiry**: required for expiry-tracked products.
3. **Put on tile(s).** With **Put away now** ticked (the default), each line shows the suggested tiles
   with quantities: the product's default tile first, then the nearest tiles with room (same zone, fewest
   rows and columns away, lowest level first). If one tile cannot take everything, the quantity is split
   over as many tiles as needed by box capacity, for example `BT-A-03-1 × 24`, `BT-A-03-2 × 36`.
   Change a tile, scan a different one, change a quantity, add or remove a tile as needed. Whatever you do
   not place waits in the putaway queue.
4. If anything is damaged, add **damage photos** (JPG, PNG or WebP, up to 10 photos, 2 MB each).
5. Press **Post receipt**. The system gives a GRN number.

**What happens to the stock**

- Good units are booked onto the **Receiving** tile and, with **Put away now**, moved straight on to the
  chosen storage tiles in the same step. Those units are **pickable at once**.
- Good units you did not place (or all of them, if **Put away now** is unticked) stay on the receiving
  tile, counted in stock but **not pickable yet**, until putaway.
- Damaged units go onto the **Damaged** tile.
- Short units are only recorded (they never arrived, so there is no stock).

The system refuses the receipt (and saves nothing) if a chosen tile is not your company's, is not an
active storage tile, would be overfilled ("tile BT-A-03-1 has room for 24 more units only (3 boxes max,
1 on it now)"), or if the tiles add up to more than the good units.

**Writing off what arrived damaged.** On **Inward receipts**, the card **Damaged on arrival** lists receipt
lines whose damaged cartons are still on the damaged tile. Press **Write off damaged**: a Damage
write-off is created with the product, batch, damaged tile and quantity filled in and the reason
"Damaged on receipt GRN-…", linked to the receipt's photos. It follows the normal approval setting. (Sending
goods back to the supplier is not part of the system; record the claim outside.)

> **Situation: "A truck arrives with 50 cartons. 3 are crushed and 2 are missing."**
> Receive against the PO: Good 45, Damaged 3, Short 2. Take photos of the crushed cartons and attach them.
> **Put away now** is ticked, so the 45 good cartons are already split over tiles: the default tile takes
> what fits, the nearest tiles take the rest. Check the suggestion against where the team actually stacks
> them and post. The 45 go **straight onto their tiles** and can be picked at once; nothing waits on the
> receiving tile. The 3 sit on the damaged tile: press **Write off damaged** on Inward receipts and the
> manager approves. The PO and the "Damage and shortage" report show the 3 damaged and 2 short with the
> photos as evidence for the supplier claim.

> **Situation: "The new batch of cream has a different expiry from the old one."**
> Enter the new batch number and expiry at receiving. From now on the system tracks the two batches
> separately and always picks the one that expires first.

> **Situation: "Someone forgot to write the batch number."**
> For expiry-tracked products the system will not post the receipt without a batch number and expiry,
> so the problem is caught at the dock, not three months later.

### 6.3 Putaway

**What it does.** Moves received goods from the receiving tile to a real storage tile. **Stock becomes
available for orders only after putaway.** Most goods are now put away while receiving (6.2); the
putaway queue holds what was not placed then: receipts posted with **Put away now** unticked, and the
remainder of a line that was only partly placed.

**Step by step (phone)**

1. Open **Putaway** (or Scan → Putaway). You see a queue of items waiting, with the quantity still left.
2. Each item has its **tile(s) filled in**:
   - first the product's **default tile**, if it is a storage tile with room;
   - then the **nearest tiles with room** in the same zone (fewest rows and columns away, lowest level
     first), split by box capacity when one tile cannot take everything.
3. Carry the goods to the tiles. If you used other tiles, **scan the tile you actually used** and fix the
   quantity. You can also put only part away now: lower the quantity, and the rest stays in the queue.
4. Press **Confirm**. The units move from the receiving tile to those tiles in one step.

The system refuses a tile that is not a storage tile, belongs to the other company, is inactive, or does
not have enough free boxes.

> **Situation: "The default tile is full."**
> The suggestion automatically skips it and offers the nearest tiles with room. If you put the goods
> somewhere else, just scan that tile instead; the system records where they really are.

> **Situation: "60 cartons arrived and the tiles near the default hold 3 and 5 boxes."**
> The suggestion splits them: default tile 3 boxes, the level above 5 boxes, the next column 3 boxes, and
> so on until all 60 are placed. If the zone runs out of room, what is left stays in the queue and the
> card shows how many are placed and how many wait.

> **Situation: "A customer order is waiting but the goods are still on the receiving tile."**
> The order cannot be picked until putaway is done (picking only uses storage tiles). Clear putaway
> first, then create the pick list. This is why the dashboard shows "Awaiting putaway", a warning card
> after 4 hours (Company settings), and why the daily digest flags anything waiting longer than that.

---

## 7. Inventory: Stock, Ledger, Transfers, Stock audits, Adjustments

### 7.1 Stock

**What it does.** Shows what you have, where, in which batch and with what expiry.

- **By product, tile and batch**, with an expiry status (fine, expiring soon, expired).
- Tap a tile to see the "what is on this tile" sheet.
- Filter, sort, save views and export to Excel.

> **Situation: "Billing asks: do we have 200 units of SKU BT-OIL-500 for a customer today?"**
> Stock → search the SKU. You see total units, how many are on storage tiles (pickable), how many are
> still on receiving, and how many are already expired (never pickable).

### 7.2 Movement ledger

**What it does.** The complete history of every stock change, newest first. Filter by product or by
tile. Each row shows the type (inward, putaway, outward, transfer, adjustment, damage…), the change
(+ or −), the document it came from, and who did it.

> **Situation: "Tile BT-C-07-1 should have 60 units but has 48. Where did 12 go?"**
> Stock → Ledger → filter tile `BT-C-07-1`. You see every in and out, with the pick list or transfer
> number and the person's name. Usually the answer is a pick or transfer someone forgot to mention.

### 7.3 Transfers

**What it does.** Moves stock from one tile to another, for example to consolidate half-empty tiles or
move fast movers closer to dispatch.

1. **Transfers**, then choose the product, batch and **From tile** (the screen shows how much is there).
2. Enter quantity and **To tile**, and a reason.
3. Press **Move stock**.

Both sides (out of one tile, into the other) are saved together or not at all, so stock can never
"disappear in between". You cannot move more than is on the tile. The destination can be a storage,
quarantine or dispatch tile.

> **Situation: "Diwali season: the gift pack is suddenly selling fast."**
> Transfer it from row F (back) to row A (near dispatch). Picking routes now start at row A, so pickers
> walk less. Check **Reports → Fast movers** monthly to decide what to move.

> **Situation: "Someone put goods on the wrong tile during putaway."**
> Do not try to "edit" the putaway. Post a transfer from the wrong tile to the right one. The ledger
> shows both steps, and stock is correct.

### 7.4 Stock audits (cycle counts)

**What it does.** Counts a few tiles at a time so every tile gets checked regularly, without closing
the warehouse for a full stock-take.

**Step by step**

1. **Stock audits → New count**. Type the tiles to count (one per line or comma separated).
2. The system takes a snapshot of what it **thinks** is on each tile (system quantity).
3. The store keeper counts physically and enters the **Counted** quantity for each line.
4. The screen shows the **variance** (counted − system) and a running "Gain / Loss" total.
5. Every line with a variance needs a **reason** (for example "breakage found", "mis-picked last week").
6. **Submit for approval**.
7. The warehouse manager reviews and either **Approves** (the system posts an adjustment for each
   variance, and stock now matches the floor) or **Sends back for recount**.

> **Situation: "System says 120, the shelf has 117."**
> Enter 117, reason "3 bottles broken, found behind pallet". The manager approves, an adjustment of −3
> is posted, and it appears in **Adjustments** and the **Cycle count variance** report.

> **Situation: "A store keeper counts lazily and types the system number."**
> The manager sees the counter's name on the count and in the audit log. A recount can be requested
> anytime. Counting a few tiles every day by different people makes this pattern easy to spot.

### 7.5 Adjustments

**What it does.** A read-only list of every approved stock correction that came from a cycle count:
which product, which tile, plus or minus, who approved it and when. Use it to watch for repeating
losses on the same product or tile.

---

## 8. Outward: Sales orders, Picking, Packing, Dispatch

### 8.1 Sales orders

**What it does.** Records what a customer wants, and tracks it through picking, packing and dispatch.

1. **Sales orders → New sales order**. Enter the customer and lines (product + quantity). Save.
2. The order detail shows, per line: **Ordered**, **On pick list**, **Picked**, **Dispatched**. This is
   how billing knows exactly where an order stands without phoning the floor.
3. Order statuses: Confirmed → Picking → Packed → Dispatched (or Cancelled).

### 8.2 Pick lists (FEFO)

**What it does.** Tells the picker exactly which tile and which batch to take each unit from.

Press **Create pick list (FEFO)** on the order. The system:

- takes the batch that **expires first** first (FEFO: First Expiry, First Out);
- **never** allocates expired stock (stock expiring today can still be picked);
- **never** promises the same units to two orders at the same time;
- orders the lines by tile code so the picker walks one route, top to bottom.

If there is not enough pickable stock, it creates the pick list for what is available and tells you
what is short ("Not enough pickable stock: BT-OIL-500 short 40"). When more stock is put away, press
**Create pick list** again; it only allocates the remainder.

**Picking on the phone**

1. Open **Pick lists** and choose the list. It shows "Go to BT-A-03-1, take 24".
2. Walk to the tile and **scan the tile label**. If you are at the wrong tile, the system says
   "Wrong tile. Pick from BT-A-03-1." and refuses.
3. Enter the quantity picked and press **Confirm**.
4. If you pick fewer than asked, you must give a reason (**short pick**), for example "carton damaged".
   The rest is freed and can be allocated again.
5. When all lines are done: "All lines picked. Hand over for packing."

> **Situation: "Two batches of the same oil: one expires in March, one in September."**
> The pick list sends the picker to the March batch first, wherever it sits. Old stock leaves before new
> stock, so you do not end up writing off expired goods.

> **Situation: "Two billing staff create orders for the last 10 units at the same moment."**
> Only one order gets them. The other one is told the stock is short. No overselling.

> **Situation: "The picker finds only 20 of the 24 units on the tile."**
> Enter 20 and the reason "only 20 on tile". The order goes ahead with 20, the remaining 4 can be
> allocated from another tile, and the manager knows to count that tile.

### 8.3 Packing check

Once every pick line is confirmed, press **Packing check done** on the order. The system refuses if any
pick line is still unconfirmed, so nothing leaves half-picked by mistake. The order becomes **Packed**.

### 8.4 Dispatch and challan

**What it does.** The moment stock actually leaves the building.

1. On the packed order, open **Dispatch**.
2. Enter **Vehicle no.**, **LR no.** and **Transporter**.
3. Optionally dispatch only part of what was picked (**partial dispatch**), for example when the truck is
   full.
4. Press **Confirm dispatch**. The system creates a **challan** number and the stock is deducted now,
   not earlier.
5. Press **Challan (PDF)** to print the delivery challan for the driver.

The order becomes **Dispatched** when every line has fully left. After a partial dispatch it stays
Packed or Picking for the rest.

> **Situation: "The truck can only take half the order today."**
> Dispatch only the lines/quantities that are loaded. The challan lists only those. Tomorrow, dispatch
> the rest on a second challan. The order shows exactly what has gone and what is still waiting.

> **Situation: "We confirmed dispatch but the truck never left / wrong vehicle number."**
> **Cancel dispatch**. The system puts the stock back on the same tiles with reversing entries (the
> original entries stay visible in the ledger). Then dispatch again with the right details. If the date
> falls in a locked period (see Company settings), the owner must unlock it first.

> **Situation: "The customer cancelled the order."**
> If nothing has been dispatched, press **Cancel order** with a reason. If something was dispatched,
> cancel those dispatches first (or handle it as a return).

---

## 9. Returns and Damages (write-offs)

### 9.1 Returns

**What it does.** Handles goods that come back from a customer.

1. **Returns → Receive a return**. Choose product, batch (if known), quantity and reason. The units land
   on the **Return** tile, not on a storage tile, so they cannot be picked by accident.
2. Someone inspects the goods and presses **Inspect**, choosing one decision:
   - **Restock to a storage tile**: the goods are fine. Scan the storage tile; they move there and become
     pickable again.
   - **Damaged: write off**: creates a write-off that needs a manager's approval.
   - **Send back to the company**: the units leave the warehouse back to the company.

> **Situation: "A customer returns 10 bottles: 8 sealed, 2 leaking."**
> Receive them as two returns (8 and 2), because each return gets one decision.
> Inspect the 8 as **Restock** to `BT-A-03-1`; inspect the 2 as **Damaged**. The manager approves the
> write-off for the 2, and stock and reports are correct.

### 9.2 Damages (damage and expiry write-offs)

**What it does.** Removes damaged or expired units from stock, with a manager's approval.

1. **Damages → Report a write-off**. Choose kind (**Damage** or **Expiry**), product, batch, tile,
   quantity and reason.
2. Nothing moves yet. The write-off waits for a warehouse manager ("Waiting for a warehouse manager").
3. The manager **Approves** (stock is reduced and the reason is recorded) or **Rejects**.

The owner can turn off the approval step in Company settings, in which case write-offs post immediately.

Cartons that arrived damaged on a truck can be written off in one tap from **Inward receipts → Damaged on
arrival → Write off damaged** (see 6.2). The write-off list shows the receipt's photos next to it.

> **Situation: "A rat chewed through 6 cartons of tissue."**
> Store keeper reports a damage write-off of 6 cartons with photos/notes. Manager checks and approves.
> The loss appears in the **Damage and shortage** report for the month.

> **Situation: "The expiry report shows 30 units of syrup expired last week."**
> They will never be picked (FEFO skips expired stock), but they still sit on the shelf and in stock.
> Report an **Expiry** write-off from the tile they are on. If disposal will take a few days, first
> transfer them to the quarantine tile so nobody confuses them with good stock. After approval stock is
> clean.

---

## 10. Reports, Owner view and the daily digest

### 10.1 Reports

**Reports** has 13 reports. Choose the report, set the **From / To** dates where relevant, press **Run
report**, then export to **Excel** or **PDF**.

| Report | Answers the question |
| --- | --- |
| Current stock by product | How much of each product do we have, and is it under minimum? |
| Current stock by batch | Which batches do we hold and when do they expire? |
| Current stock by tile | What is on each tile right now? |
| Stock valuation | What is our stock worth at purchase price and at MRP? |
| Stock ageing | How long has each batch been sitting since it was first received? |
| Slow and dead stock | What is not moving compared with how much we hold? |
| Fast movers | What sells the most in this period? (use it to place goods near dispatch) |
| Inward vs outward | How much came in and went out each day? |
| Damage and shortage | What was damaged or short, when and why? (supplier claims) |
| Cycle count variance | Which counts found differences, and how big? |
| Expiry report | What expires soon or has already expired? |
| Movement ledger | Every stock change in the period |
| User activity | Who did how much, and what? |

> **Situation: "The accountant needs the closing stock value for 31 March."**
> Reports → Stock valuation → export to Excel. It is computed from the ledger, so it matches every
> movement exactly.

> **Situation: "Money is stuck in stock that never sells."**
> Reports → Slow and dead stock for the last 90 days. Products with stock but no outward are candidates
> for a discount scheme or returning to the company.

### 10.2 Owner view

Only the owner sees this. It puts **Bond Therapy and Rich Fill side by side**: stock value (purchase
price and MRP), units, active SKUs, inward and outward today, products below minimum, expiring in 90
days, waiting for putaway and open pick lists, with a total column.

> **Situation: "Which company is holding more money in the warehouse this month?"**
> Owner view answers it on one screen, without running two sets of reports.

### 10.3 Daily digest and alerts

Once a day the system checks each company and raises **alerts** for:

- products **below minimum** stock;
- batches expiring within **90, 60 and 30 days**, and already expired ones;
- goods **waiting for putaway** longer than the company's receiving warning time (Company settings,
  default 4 hours; the same number drives the dashboard warning card);
- **pick lists** open more than 24 hours;
- **write-offs and counts** waiting for approval more than 48 hours.

Each alert is sent once (an expiring batch alerts at 90, again at 60 and again at 30 days). A low-stock
alert clears itself when stock recovers, so it can alert again the next time it dips. Alerts appear on
the dashboard and are sent as one message to the **digest recipients** (emails or WhatsApp numbers) set
in Company settings.

> **Situation: "Nobody noticed a batch was close to expiry until it expired."**
> With the digest, the manager hears about it 90 days ahead, again at 60 and again at 30, which is enough
> time to push that batch in sales or return it.

---

## 11. Admin: Users, Audit log, Company settings

### 11.1 Users

Admins manage the people who can sign in to their company.

1. **Users → New user**: name, email, role, initial password.
2. To change a role or reset a password, open the user and edit.
3. To stop someone signing in (for example when they leave), untick **Can sign in**. Their history stays.

Changing a password or deactivating a user signs them out everywhere immediately. Nobody can change
their own role or deactivate themselves, and the owner account cannot be edited from here.

> **Situation: "A store keeper left the company today."**
> Users → open the person → untick "Can sign in" → Save. Their phone is signed out at once. Everything
> they did is still in the ledger and audit log under their name.

> **Situation: "A store keeper's phone was lost."**
> Reset that user's password. All their sessions end, including the one on the lost phone.

### 11.2 Audit log

A searchable list of **who did what, when and from where**: every create, edit, approval, cancellation,
and settings change, with the values before and after.

> **Situation: "Who changed the minimum stock of BT-OIL-500?"**
> Audit log → search the SKU. You see the user, the time, and old vs new values.

### 11.3 Company settings (owner / admin)

| Setting | What it does |
| --- | --- |
| Write-offs need a manager's approval | On (default): write-offs wait for approval. Off: they post immediately. |
| Cycle-count variances need a manager's approval | On (default): counts wait for approval. Off: they adjust stock on submit. |
| Lock everything before | A date. Nothing dated before it can be reversed or cancelled. Use it after month-end closing. |
| Warn about goods on the receiving tile after (hours) | Default 4. The dashboard warning card and the daily digest flag goods not put away within this time. |
| Daily digest recipients | Emails or WhatsApp numbers, separated by commas. |
| Export all data | Downloads every table for this company as an Excel workbook. |

> **Situation: "Accounts closed September. We don't want anyone cancelling a September dispatch now."**
> Set **Lock everything before** to 1 October. Any attempt to cancel or reverse an older entry is refused
> with "This period is locked. Ask the owner to unlock it."

> **Situation: "We want our own backup copy of everything."**
> Company settings → **Download export**. You get the full company data in one Excel file. (The server
> database is also backed up separately; see RUNBOOK.md.)

---

## 12. A full day in the warehouse, start to finish

A worked example for Bond Therapy, following one product: **BT-OIL-500, Massage oil 500 ml**, min stock
100, pack size 12 per carton, default tile `BT-A-03-1` (capacity 25 boxes).

**9:00 Dashboard check (manager).** Below minimum: 1 (BT-OIL-500, 60 units left). Awaiting putaway: 0.
A PO for 600 units is already raised and due today.

**10:30 Truck arrives (manager / store keeper).** Purchase orders → open the PO → Receive goods.
Good 576 (48 cartons of 12), damaged 12 (one carton leaking, photo attached), short 12 (one carton
missing). Batch `B2611`, expiry 30-09-2027. **Put away now** is ticked: `BT-A-03-1` has room for 20
more boxes (240 units), so the suggestion is `BT-A-03-1 × 240` and `BT-A-04-1 × 336`. The store keeper
stacks the cartons that way, Post receipt → GRN created. The PO shows "Partly received". The 576 units
are on their tiles and pickable now; 12 sit on the damaged tile.

**11:00 Damaged carton (manager).** Inward receipts → Damaged on arrival → **Write off damaged** on the
GRN line. The write-off is created with the photo linked.

**12:00 Order comes in (billing).** Sales orders → New → customer "City Wellness", BT-OIL-500 × 200.
Save → Create pick list (FEFO). The old batch (60 units, expires March) is allocated first from
`BT-A-03-1`, then 140 from the new batch on `BT-A-03-1` and `BT-A-04-1`.

**12:30 Picking (store keeper).** Pick list: "Go to BT-A-03-1, take 60" (old batch) → scan tile → 60 →
Confirm. Then the new batch lines → scan → Confirm. All lines picked.

**13:00 Packing and dispatch.** Packing check done → Dispatch: vehicle MH12AB1234, LR 55821,
transporter "Shree Logistics" → Confirm dispatch → print challan. Stock drops by 200 now.

**15:00 Write-off approval (manager).** The 11:00 write-off of the 12 leaking units is approved. They
leave stock and show in "Damage and shortage".

**17:00 Cycle count (store keeper + manager).** Count `BT-A-03-1` and `BT-A-04-1`. Counted figures match
the system. No variance. Submit, manager approves.

**Next morning, digest.** BT-OIL-500 is back above minimum, so no low-stock alert. Nothing is waiting
for putaway. The PO still shows 12 short, ready for the supplier claim.

---

## 13. Situation handbook: "if this happens, do this"

Quick answers for the most common real-life problems.

### Receiving

| Situation | What to do in the WMS |
| --- | --- |
| Truck arrives without a PO | Inward → Receive goods → "No PO (direct receipt)". |
| More arrived than ordered | Receive what actually arrived; the PO detail shows the extra. |
| Cartons crushed or leaking | Enter them as **Damaged** with photos. They go to the damaged tile, not storage. Then **Write off damaged** on Inward receipts. |
| Good cartons ready to stack at the dock | Keep **Put away now** ticked, check the suggested tiles, post: they go straight to the tiles. |
| Unloading in a rush, no time to stack | Untick **Put away now**; everything waits on the receiving tile for the putaway queue. |
| Suggested tile is already physically full | Scan the tile you really used, or set that tile's capacity right (tap it → Capacity). |
| Cartons missing | Enter them as **Short**. They appear on the PO and in Damage and shortage. |
| Two batches in one delivery | Add two lines for the same product with different batch and expiry. |
| Goods received but nobody shelved them | The dashboard warning card (after 4 h, see Company settings) and the digest flag it. Clear the putaway queue. |

### Storage

| Situation | What to do in the WMS |
| --- | --- |
| Don't know where a product is | Scan its barcode, or Stock → search SKU. |
| Don't know what is on a tile | Scan the tile label, or tap it on the floor map. |
| Goods on the wrong tile | Transfer from the wrong tile to the right one. |
| Tile is full | Putaway suggests the next nearest tile with room automatically, splitting over tiles if needed. |
| Big cartons: only 4 fit on a tile | Product → **Max boxes per tile** = 4. |
| Floor map shows a yellow **?** on tiles | Their capacity is not set. Locations → Set capacity. |
| A whole row's capacity is wrong | Locations → Set capacity (zone, rows, columns, levels), or tick the tiles in the table. |
| Want to empty a tile to repair the floor | Transfer everything off, then deactivate the tile. |
| Rack reorganisation | Transfer stock, set new default tiles on products, print new labels. |

### Orders and dispatch

| Situation | What to do in the WMS |
| --- | --- |
| Not enough stock for an order | Pick list is created for what is available; the shortage is shown. Create another pick list after the next receipt. |
| Picker finds fewer units than the list says | Confirm the actual quantity with a short-pick reason, then count that tile. |
| Picker went to the wrong tile | The system refuses the scan and says which tile to go to. |
| Truck can't take everything | Partial dispatch now, the rest later on a second challan. |
| Dispatch confirmed by mistake | Cancel dispatch; stock returns to the same tiles. |
| Customer cancels before dispatch | Cancel order with a reason. |
| Urgent order but goods still on receiving | Do putaway first, then create the pick list. |

### Losses and differences

| Situation | What to do in the WMS |
| --- | --- |
| Breakage found on the shelf | Report a Damage write-off; manager approves. |
| Expired stock found | It is already blocked from picking. Report an Expiry write-off (optionally move it to quarantine first). |
| Shelf count differs from system | Stock audit → count → reason → manager approves → stock corrected. |
| Same product keeps going missing | Check Adjustments and the Cycle count variance report, then the ledger and audit log for that tile. |
| Customer returns goods | Returns → Receive → Inspect → Restock, Write off or Send back. |

### People and control

| Situation | What to do in the WMS |
| --- | --- |
| New employee joins | Users → New user with the smallest role that fits. |
| Employee leaves / phone lost | Untick "Can sign in" or reset the password; sessions end at once. |
| "Who did this?" | Audit log, or the ledger's "By" column. |
| Month closed by accounts | Company settings → Lock everything before. |
| Owner wants a quick comparison of both companies | Owner view. |
| Accountant wants figures | Reports → export to Excel or PDF. |
| Internet drops on the floor | Wait for the yellow "Reconnecting" bar to clear. Nothing is lost; double saves are prevented. |

---

## 14. Daily, weekly and monthly habits

**Every day**

- Morning: read the dashboard and the alerts (or the digest message).
- Put good cartons away while receiving (keep **Put away now** ticked); clear the putaway queue
  before the yellow dashboard warning appears, and always before the end of the day.
- Write off cartons damaged on arrival from Inward receipts the same day.
- No pick list left open overnight.
- Count a few tiles (Stock audits) so every tile is counted once a month.
- Manager: clear write-offs and counts waiting for approval.

**Every week**

- Run **Expiry report** and push or return batches expiring within 90 days.
- Check **Current stock by product** against minimums and raise POs.
- Floor map: fill in any tile with a yellow **?** (capacity not set) and fix capacities that turned out
  wrong.

**Every month**

- Run **Fast movers** and **Slow and dead stock**; move fast movers to rows A-B near dispatch.
- Run **Stock valuation** and **Damage and shortage** for accounts.
- After accounts close the month, set **Lock everything before**.
- Admin: review the **Users** list and deactivate anyone who has left.

---

## 15. Glossary

| Word | Meaning |
| --- | --- |
| SKU | Unique product code |
| Tile | One numbered storage spot on the floor, e.g. `BT-A-03-1` |
| Zone | Group of tiles; starts with the company code (BT…, RF…) |
| PO | Purchase order: what you expect to receive |
| GRN | Goods received note: what actually arrived |
| Putaway | Moving received goods to a storage tile; makes them pickable. Usually done while receiving ("Put away now") |
| Capacity (boxes) | How many cartons fit on a tile; units become boxes through the product pack size |
| Max boxes per tile | Optional product limit for big cartons |
| FEFO | First Expiry, First Out: the earliest-expiring batch is picked first |
| Pick list | The picker's route: which tile, which batch, how many |
| Short pick | Picking fewer units than the list asks, with a reason |
| Challan | Delivery document printed at dispatch |
| LR no. | Lorry receipt number from the transporter |
| Write-off | Removing damaged or expired units from stock, with approval |
| Cycle count / Stock audit | Counting a few tiles and correcting differences, with approval |
| Variance | Counted minus system quantity |
| Adjustment | The approved stock correction that comes from a count |
| Ledger | The permanent list of every stock movement |
| Period lock | A date before which nothing can be reversed or cancelled |
| Digest | The daily alert message sent to email or WhatsApp |

---

*Related documents in this folder: `docs/USER-MANUAL.md` (short guide with screenshots per role),
`docs/TILES.md` (tile numbering and slotting), `docs/RUNBOOK.md` (server operations, backups),
`docs/GO-LIVE.md` (go-live checklist).*
