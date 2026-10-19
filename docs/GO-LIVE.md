# Go-live checklist

## Before the first real day

- [ ] Change every seeded user's password (Users → edit), delete or deactivate users you don't need.
- [ ] Remove sample data: the production database still holds the seed's sample products and stock.
      Recommended: create a fresh Postgres, `prisma migrate deploy`, create real users/products/tiles,
      then switch `DATABASE_URL` (seed stock cannot be deleted from the append-only ledger).
- [ ] Import the real product list (Products → Import) for each company.
- [ ] Generate and print tile labels (Locations → New tile → Generate; Labels → Tiles).
- [ ] Opening stock: receive it as a direct receipt per tile (Inward → Receive goods, no PO), then putaway.
- [ ] Company settings: digest recipients, approval rules.
- [ ] Railway GitHub app has access to BT-WMS (so pushes deploy automatically).
- [ ] Backup cron service with S3/R2 credentials; run it once and do a restore into a scratch database.
- [ ] Set `ERROR_WEBHOOK_URL` and `DIGEST_WEBHOOK_URL` if you want error alerts / digest delivery.
- [ ] Custom domain on Railway (Settings → Networking) if wanted.
- [ ] Train each role with docs/USER-MANUAL.md; one dry-run day on staging.

## Day one

- [ ] Watch `/api/health` and Railway logs for `level":"error"`.
- [ ] Owner view at end of day: units per company match the physical count of a few tiles.

## Still risky / not done

- **Sample data in production**: see above; plan a clean database before go-live.
- **Auto-deploy**: Railway was connected by repo URL; until the GitHub app has repo access, deploy with `railway up`.
- **Digest delivery** needs a gateway (email service or WhatsApp provider) behind `DIGEST_WEBHOOK_URL`;
  without it the digest only goes to the logs.
- **Backups** need S3/R2 credentials; without the cron service only Railway's volume snapshots exist.
- **Rate limits** are per app instance (in memory); with several replicas use a shared store.
- **Camera scanning** uses the browser's BarcodeDetector (Chrome/Edge on Android, desktop Chrome).
  iPhone Safari users scan with a Bluetooth/USB scanner or type the code.
- **Hindi**: the app is ready for it (all text in `messages/*.json`) but no Hindi file exists yet.
- **Cycle counts** only list stock the system expects on a tile; unexpected finds need a receipt/transfer.
- **Challan PDF** holds ~30 lines per dispatch; larger dispatches need a page-break improvement.
