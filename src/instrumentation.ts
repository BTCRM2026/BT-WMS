// In-app scheduler: every 15 minutes, after DIGEST_HOUR (IST, default 08:00), run the
// daily digest. runDailyDigest() itself guarantees one run per day across instances.
// Disable with SCHEDULER=off (e.g. when a Railway cron service calls /api/cron/daily).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.SCHEDULER === "off" || process.env.NODE_ENV !== "production")
    return;
  const { runDailyDigest } = await import("@/server/alerts");
  const { logger } = await import("@/server/log");
  const hour = Number(process.env.DIGEST_HOUR ?? 8);
  const tick = async () => {
    const ist = new Date(Date.now() + 5.5 * 3600_000);
    if (ist.getUTCHours() < hour) return;
    try {
      const r = await runDailyDigest();
      if (!r.skipped) logger.info("job.daily-digest", r.result);
    } catch (e) {
      logger.error("job.daily-digest.failed", { error: String(e) });
    }
  };
  setInterval(tick, 15 * 60_000).unref();
  setTimeout(tick, 60_000).unref();
}
