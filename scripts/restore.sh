#!/usr/bin/env bash
# Restore a backup into an EMPTY database, then check stock totals.
#   ./scripts/restore.sh s3://bt-wms-backups/daily/bt-wms-2026-10-19T203000Z.dump "postgresql://.../wms_restore"
# Never point TARGET_URL at production: create a fresh database first, verify, then switch DATABASE_URL.
set -euo pipefail
src="$1"; target="$2"
file=/tmp/restore.dump
endpoint=${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"}
case "$src" in s3://*) aws s3 cp "$src" "$file" $endpoint ;; *) cp "$src" "$file" ;; esac
tables=$(psql "$target" -tAc "select count(*) from information_schema.tables where table_schema='public'")
if [ "$tables" != "0" ]; then echo "Target database is not empty; refusing to restore." >&2; exit 1; fi
pg_restore --no-owner --no-acl --exit-on-error --dbname="$target" "$file"
psql "$target" -c "select c.name, sum(b.quantity) as units from stock_balance b join companies c on c.id=b.company_id group by c.name order by c.name"
echo "restore ok - compare the units above with the live dashboard / owner view"
