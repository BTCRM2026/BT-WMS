-- Tile capacity is now counted in BOXES (cartons), not units.
-- Existing locations.capacity values are kept as they are and now read as boxes:
-- a tile can hold several products with different pack sizes, so there is no
-- single correct units -> boxes conversion. Review capacities after deploy
-- (Locations -> Set capacity in bulk); tiles with no capacity stay unlimited.
COMMENT ON COLUMN "locations"."capacity" IS 'Boxes (cartons) that fit on the tile; NULL = not set (unlimited)';

-- Optional per-product limit: at most this many boxes of the product on one tile.
ALTER TABLE "products" ADD COLUMN "max_boxes_per_tile" INTEGER;
ALTER TABLE "products"
  ADD CONSTRAINT "products_max_boxes_per_tile_chk" CHECK ("max_boxes_per_tile" IS NULL OR "max_boxes_per_tile" > 0);

-- Partial putaway: how many good units of a receipt line are already on storage tiles.
ALTER TABLE "inward_receipt_lines" ADD COLUMN "putaway_quantity" INTEGER NOT NULL DEFAULT 0;
UPDATE "inward_receipt_lines" SET "putaway_quantity" = "quantity" WHERE "putaway_at" IS NOT NULL;
ALTER TABLE "inward_receipt_lines"
  ADD CONSTRAINT "inward_receipt_lines_putaway_quantity_chk" CHECK ("putaway_quantity" >= 0 AND "putaway_quantity" <= "quantity");

-- Write-off of cartons damaged on arrival, linked to the receipt line (and so to its photos).
ALTER TABLE "damages" ADD COLUMN "receipt_line_id" TEXT;
CREATE INDEX "damages_company_id_receipt_line_id_idx" ON "damages"("company_id", "receipt_line_id");

-- Early warning for goods left on the RECEIVING tile (hours; default 4).
ALTER TABLE "company_settings" ADD COLUMN "receiving_alert_hours" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "company_settings"
  ADD CONSTRAINT "company_settings_receiving_alert_hours_chk" CHECK ("receiving_alert_hours" BETWEEN 1 AND 168);
