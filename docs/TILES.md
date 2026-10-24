# Tile numbering and slotting guide (one page)

## The code

```
BT - A - 03 - 1
│    │   │    └─ LEVEL   1 = floor (stack levels 2, 3 … if you stack pallets)
│    │   └────── COLUMN  2 digits, counted from the wall with the entrance (01, 02 … 20)
│    └────────── ROW     letter, counted from the dispatch side (A, B, C …)
└─────────────── ZONE    starts with the company code: BT… = Bond Therapy, RF… = Rich Fill
```

- Bond Therapy zones start with **BT** (BT, BT2, BTX), Rich Fill zones with **RF**. The system refuses
  to put one company's stock in the other company's zone.
- Special areas live in the `…X` zone: `BTX-R-01-1` receiving, `BTX-D-01-1` dispatch,
  `BTX-X-01-1` damaged, `BTX-Q-01-1` quarantine, `BTX-RT-01-1` customer returns.

## Rooms

Each room of the warehouse is one zone with a name: **Locations → Rooms → New room**, e.g. code `BT1`,
name "Room 1", where "Near the gate". Tap a room to go inside: you see only its rows, one line per row, and
**Add row** creates the next row of tiles (row letter, how many tiles, boxes per tile, what it is used for).
**Leave room** takes you back to the list. Put Receiving, Dispatch, Returns, Damaged and Quarantine as rows of
the room near the gate (choose them under "Used for"). Phones open Rooms from the bottom bar.

## Marking the floor

1. Generate the tiles once: **Locations → New tile → Generate tiles** (e.g. zone BT, rows A-F, columns 1-20,
   levels 1-3) with a **capacity per level in boxes** (e.g. level 1 = 3, level 2 = 5, level 3 = 5).
2. Print **Labels → Tiles → A4 sheet** (QR) and stick one on the floor at the front-left corner of each tile,
   plus one at eye level on the nearest pillar for each row.
3. Paint or tape the row letter at both ends of the aisle.

## Slotting rules

- **Fast movers near dispatch** (rows A-B), slow movers at the back. Re-check monthly with
  **Reports → Fast movers** and **Slow and dead stock**.
- **One product per tile when possible.** Put the same product's batches on neighbouring tiles; picking is FEFO,
  so the earliest expiry is picked first wherever it sits.
- Set each product's **default tile**: putaway suggests it first, then the nearest tiles with room in the same zone
  (fewest rows + columns away, lowest level), splitting a delivery over several tiles when needed.
- **Capacity is in boxes (cartons)**, per tile, so each level has its own. Units become boxes through the product's
  pack size (a part carton counts as one box). Putaway refuses to overfill a tile.
- Big cartons: set the product's **Max boxes per tile** (e.g. 4). Room for a product on a tile =
  min(tile capacity, product max boxes per tile) − boxes already on the tile.
- Fix capacities in bulk with **Locations → Set capacity** (zone, rows, columns, levels) or by ticking tiles in the
  table. Tiles with no capacity are unlimited and show a yellow **?** on the floor map until you fill them in.
- Heavy cartons on level 1. Liquids never above level 2.
- Damaged, quarantine and return stock never sits on storage tiles: it lives on the special tiles until a decision.

## Daily habits

- Put good cartons away while receiving (**Put away now**); putaway queue empty by end of day (Inward → Putaway).
  The dashboard warns when goods sit on the receiving tile longer than the hours set in Company settings (default 4).
- Count a few tiles every day (Stock audits) so every tile is counted once a month.
