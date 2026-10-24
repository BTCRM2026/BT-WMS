-- Rooms: a named group of tiles. A room's tiles are the locations whose zone equals rooms.zone.
-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rooms_company_id_idx" ON "rooms"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_id_company_id_key" ON "rooms"("id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_warehouse_id_zone_key" ON "rooms"("warehouse_id", "zone");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_zone_chk" CHECK ("zone" ~ '^[A-Z0-9]{2,4}$'),
  ADD CONSTRAINT "rooms_name_chk" CHECK (char_length(btrim("name")) BETWEEN 1 AND 60),
  ADD CONSTRAINT "rooms_note_chk" CHECK ("note" IS NULL OR char_length("note") <= 120);
