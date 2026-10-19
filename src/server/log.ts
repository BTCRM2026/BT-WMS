// Structured JSON logs (one line per event) so Railway's log search can filter them.
type Fields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", msg: string, fields?: Fields) {
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields });
  if (level === "error") {
    console.error(line);
    // Error-tracking hook: forward to Sentry/Slack/anything that accepts a JSON POST.
    if (process.env.ERROR_WEBHOOK_URL)
      fetch(process.env.ERROR_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: line,
      }).catch(() => {});
  } else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, f?: Fields) => write("info", msg, f),
  warn: (msg: string, f?: Fields) => write("warn", msg, f),
  error: (msg: string, f?: Fields) => write("error", msg, f),
};
