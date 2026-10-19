#!/usr/bin/env bash
# Daily Postgres backup to S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2...).
# Run as a Railway cron service (schedule "30 20 * * *" = 02:00 IST) with:
#   DATABASE_URL  - ${{Postgres.DATABASE_URL}}
#   S3_BUCKET     - e.g. s3://bt-wms-backups
#   S3_ENDPOINT   - optional, for R2/B2 (e.g. https://<account>.r2.cloudflarestorage.com)
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_DEFAULT_REGION
#   KEEP_DAYS     - optional retention (default 30)
# Needs: pg_dump (same major version as the server or newer) and the aws CLI.
set -euo pipefail
stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
file="/tmp/bt-wms-${stamp}.dump"
pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL" --file="$file"
pg_restore --list "$file" > /dev/null   # the dump must be readable before we keep it
endpoint=${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"}
aws s3 cp "$file" "${S3_BUCKET}/daily/bt-wms-${stamp}.dump" $endpoint
rm -f "$file"
# Retention: delete dumps older than KEEP_DAYS.
cutoff=$(date -u -d "-${KEEP_DAYS:-30} days" +%Y-%m-%d)
aws s3 ls "${S3_BUCKET}/daily/" $endpoint | awk '{print $4}' | while read -r name; do
  d=${name#bt-wms-}; d=${d:0:10}
  [[ "$d" < "$cutoff" ]] && aws s3 rm "${S3_BUCKET}/daily/${name}" $endpoint
done
echo "backup ok: bt-wms-${stamp}.dump"
