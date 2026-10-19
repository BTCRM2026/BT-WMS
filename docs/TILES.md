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

## Marking the floor

1. Generate the tiles once: **Locations → New tile → Generate tiles** (e.g. zone BT, rows A-F, columns 1-20, level 1).
2. Print **Labels → Tiles → A4 sheet** (QR) and stick one on the floor at the front-left corner of each tile,
   plus one at eye level on the nearest pillar for each row.
3. Paint or tape the row letter at both ends of the aisle.

## Slotting rules

- **Fast movers near dispatch** (rows A-B), slow movers at the back. Re-check monthly with
  **Reports → Fast movers** and **Slow and dead stock**.
- **One product per tile when possible.** Put the same product's batches on neighbouring tiles; picking is FEFO,
  so the earliest expiry is picked first wherever it sits.
- Set each product's **default tile**: putaway suggests it first, then the nearest free tile in the same zone.
- Keep **capacity** realistic (units that fit on the tile); putaway refuses to overfill a tile.
- Heavy cartons on level 1. Liquids never above level 2.
- Damaged, quarantine and return stock never sits on storage tiles: it lives on the special tiles until a decision.

## Daily habits

- Putaway queue empty by end of day (Inward → Putaway).
- Count a few tiles every day (Stock audits) so every tile is counted once a month.
