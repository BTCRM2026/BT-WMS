/*
  Warnings:

  - The `status` column on the `returns` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('RECEIVED', 'INSPECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReturnDisposition" AS ENUM ('RESTOCK', 'DAMAGE', 'SEND_BACK');

-- CreateEnum
CREATE TYPE "WriteOffKind" AS ENUM ('DAMAGE', 'EXPIRY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockAuditStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "StockAuditStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "adjustments" ADD COLUMN     "approved_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "damages" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "kind" "WriteOffKind" NOT NULL DEFAULT 'DAMAGE',
ADD COLUMN     "return_id" TEXT;

-- AlterTable
ALTER TABLE "dispatch_lines" ADD COLUMN     "location_id" TEXT,
ADD COLUMN     "pick_list_line_id" TEXT;

-- AlterTable
ALTER TABLE "dispatches" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "lr_number" TEXT,
ADD COLUMN     "packed_at" TIMESTAMP(3),
ADD COLUMN     "transporter" TEXT;

-- AlterTable
ALTER TABLE "inward_receipt_lines" ADD COLUMN     "damaged_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "expected_quantity" INTEGER,
ADD COLUMN     "putaway_at" TIMESTAMP(3),
ADD COLUMN     "putaway_by_id" TEXT,
ADD COLUMN     "putaway_location_id" TEXT,
ADD COLUMN     "short_quantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pick_list_lines" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_by_id" TEXT,
ADD COLUMN     "short_reason" TEXT;

-- AlterTable
ALTER TABLE "returns" ADD COLUMN     "customer_name" TEXT,
ADD COLUMN     "disposition" "ReturnDisposition",
ADD COLUMN     "inspected_at" TIMESTAMP(3),
ADD COLUMN     "inspected_by_id" TEXT,
ADD COLUMN     "inspection_notes" TEXT,
ADD COLUMN     "restock_location_id" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "ReturnStatus" NOT NULL DEFAULT 'RECEIVED';

-- AlterTable
ALTER TABLE "stock_audit_lines" ADD COLUMN     "variance_reason" TEXT;

-- AlterTable
ALTER TABLE "stock_audits" ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "submitted_by_id" TEXT;

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_company_id_key_key" ON "idempotency_keys"("company_id", "key");

-- CreateIndex
CREATE INDEX "attachments_company_id_entity_entity_id_idx" ON "attachments"("company_id", "entity", "entity_id");

-- ---------------------------------------------------------------- phase 3 integrity
ALTER TABLE "inward_receipt_lines"
  DROP CONSTRAINT "inward_receipt_lines_quantity_chk",
  ADD CONSTRAINT "inward_receipt_lines_quantity_chk" CHECK (
    "quantity" >= 0 AND "damaged_quantity" >= 0 AND "short_quantity" >= 0
    AND ("quantity" + "damaged_quantity") > 0
    AND ("expected_quantity" IS NULL OR "expected_quantity" >= 0));

ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id");
ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id"),
  ADD CONSTRAINT "attachments_size_chk" CHECK ("size" > 0 AND "size" <= 5242880);

-- ---------------------------------------------------------------- tile code meaning
-- Tile codes are <ZONE>-<ROW letter>-<COLUMN>-<LEVEL> (e.g. BT-A-03-1 = zone BT, row A,
-- column 3, level 1). Re-derive the grid fields of existing tiles from their codes.
UPDATE "locations" SET
  "zone"   = split_part("code", '-', 1),
  "row"    = CASE WHEN length(split_part("code", '-', 2)) = 1 THEN ascii(split_part("code", '-', 2)) - 64 ELSE 0 END,
  "column" = split_part("code", '-', 3)::int,
  "level"  = split_part("code", '-', 4)::int;
