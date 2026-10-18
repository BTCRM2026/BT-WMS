-- Integrity rules Prisma cannot express: CHECK constraints, the append-only
-- stock ledger, the no-negative-stock guard and the stock_balance view.

-- ---------------------------------------------------------------- CHECKs
ALTER TABLE "products"
  ADD CONSTRAINT "products_min_stock_chk" CHECK ("min_stock" >= 0),
  ADD CONSTRAINT "products_max_stock_chk" CHECK ("max_stock" IS NULL OR "max_stock" >= "min_stock"),
  ADD CONSTRAINT "products_pack_size_chk" CHECK ("pack_size" > 0),
  ADD CONSTRAINT "products_prices_chk" CHECK ("mrp" >= 0 AND "purchase_price" >= 0);

ALTER TABLE "batches"
  ADD CONSTRAINT "batches_dates_chk" CHECK ("expiry_date" IS NULL OR "mfg_date" IS NULL OR "expiry_date" >= "mfg_date");

ALTER TABLE "locations"
  ADD CONSTRAINT "locations_code_chk" CHECK ("code" ~ '^[A-Z0-9]{2,4}-[A-Z]{1,2}-[0-9]{2}-[0-9]{1,2}$'),
  ADD CONSTRAINT "locations_grid_chk" CHECK ("row" >= 0 AND "column" >= 0 AND "level" >= 0),
  ADD CONSTRAINT "locations_capacity_chk" CHECK ("capacity" IS NULL OR "capacity" > 0);

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_quantity_chk" CHECK ("quantity" > 0),
  ADD CONSTRAINT "stock_movements_direction_chk" CHECK ("direction" IN (1, -1)),
  ADD CONSTRAINT "stock_movements_type_direction_chk" CHECK (
    "reversal_of_id" IS NOT NULL
    OR "type" = 'ADJUSTMENT'
    OR ("type" IN ('INWARD', 'TRANSFER_IN', 'RETURN') AND "direction" = 1)
    OR ("type" IN ('OUTWARD', 'TRANSFER_OUT', 'DAMAGE') AND "direction" = -1)
  );

ALTER TABLE "purchase_order_lines"
  ADD CONSTRAINT "purchase_order_lines_quantity_chk" CHECK ("quantity" > 0 AND "unit_price" >= 0);
ALTER TABLE "inward_receipt_lines"
  ADD CONSTRAINT "inward_receipt_lines_quantity_chk" CHECK ("quantity" > 0);
ALTER TABLE "sales_order_lines"
  ADD CONSTRAINT "sales_order_lines_quantity_chk" CHECK ("quantity" > 0 AND "unit_price" >= 0);
ALTER TABLE "pick_list_lines"
  ADD CONSTRAINT "pick_list_lines_quantity_chk" CHECK ("quantity" > 0 AND "picked_quantity" >= 0 AND "picked_quantity" <= "quantity");
ALTER TABLE "dispatch_lines"
  ADD CONSTRAINT "dispatch_lines_quantity_chk" CHECK ("quantity" > 0);
ALTER TABLE "returns"
  ADD CONSTRAINT "returns_quantity_chk" CHECK ("quantity" > 0);
ALTER TABLE "damages"
  ADD CONSTRAINT "damages_quantity_chk" CHECK ("quantity" > 0);
ALTER TABLE "stock_audit_lines"
  ADD CONSTRAINT "stock_audit_lines_quantity_chk" CHECK ("system_quantity" >= 0 AND ("counted_quantity" IS NULL OR "counted_quantity" >= 0));
ALTER TABLE "adjustments"
  ADD CONSTRAINT "adjustments_quantity_chk" CHECK ("quantity" > 0 AND "direction" IN (1, -1));

-- ------------------------------------------------- append-only stock ledger
CREATE FUNCTION stock_movements_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements is append-only: % is not allowed; post a reversing entry instead', TG_OP
    USING ERRCODE = 'P0001';
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_no_update_delete
  BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION stock_movements_block_mutation();

CREATE TRIGGER stock_movements_no_truncate
  BEFORE TRUNCATE ON "stock_movements"
  FOR EACH STATEMENT EXECUTE FUNCTION stock_movements_block_mutation();

-- -------------------------------------------------- no negative stock, ever
-- Serialises writers per (company, product, location, batch) with a
-- transaction-scoped advisory lock, then checks the resulting balance.
CREATE FUNCTION stock_movements_guard_negative() RETURNS trigger AS $$
DECLARE
  balance bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW."company_id" || ':' || NEW."product_id" || ':' || NEW."location_id" || ':' || coalesce(NEW."batch_id", ''), 0));

  IF NEW."direction" = -1 THEN
    SELECT coalesce(sum("direction" * "quantity"), 0) INTO balance
      FROM "stock_movements"
     WHERE "company_id" = NEW."company_id"
       AND "product_id" = NEW."product_id"
       AND "location_id" = NEW."location_id"
       AND "batch_id" IS NOT DISTINCT FROM NEW."batch_id";

    IF balance - NEW."quantity" < 0 THEN
      RAISE EXCEPTION 'Insufficient stock: available %, requested %', balance, NEW."quantity"
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_no_negative
  BEFORE INSERT ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION stock_movements_guard_negative();

-- ------------------------------------------------------- derived balance
CREATE VIEW "stock_balance" AS
SELECT md5("company_id" || ':' || "product_id" || ':' || "location_id" || ':' || coalesce("batch_id", '')) AS "id",
       "company_id",
       "warehouse_id",
       "product_id",
       "batch_id",
       "location_id",
       sum("direction" * "quantity")::int AS "quantity"
  FROM "stock_movements"
 GROUP BY "company_id", "warehouse_id", "product_id", "batch_id", "location_id"
HAVING sum("direction" * "quantity") <> 0;
