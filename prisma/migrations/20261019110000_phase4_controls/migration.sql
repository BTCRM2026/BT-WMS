

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "write_off_approval" BOOLEAN NOT NULL DEFAULT true,
    "count_approval" BOOLEAN NOT NULL DEFAULT true,
    "locked_before" TIMESTAMP(3),
    "digest_recipients" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "run_key" TEXT NOT NULL,
    "result" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_company_id_key" ON "company_settings"("company_id");

-- CreateIndex
CREATE INDEX "alert_events_company_id_created_at_idx" ON "alert_events"("company_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "alert_events_company_id_kind_key_key" ON "alert_events"("company_id", "kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_run_key_key" ON "job_runs"("run_key");


ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id");
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id");
