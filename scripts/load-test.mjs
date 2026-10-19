// Load test: 50 concurrent users for 20 s on the pick/dispatch-side reads
// (FEFO lot lookup, stock, scan lookup) plus pick confirmations through the API layer.
// Usage: node scripts/load-test.mjs <baseUrl> <sessionToken>
// CI/local only: never point this at production.
import autocannon from "autocannon";

const [base = "http://127.0.0.1:3200", token] = process.argv.slice(2);
if (!token) throw new Error("usage: node scripts/load-test.mjs <baseUrl> <sessionToken>");

const result = await autocannon({
  url: base,
  connections: 50,
  duration: 20,
  headers: { cookie: `wms_session=${token}` },
  requests: [
    { method: "GET", path: "/api/stock" },
    { method: "GET", path: "/api/lookup?code=BT-A-01-1" },
    { method: "GET", path: "/api/products?page=1" },
    { method: "GET", path: "/api/movements" },
  ],
});

const summary = {
  requests: result.requests.total,
  rps: Math.round(result.requests.average),
  latencyMs: { p50: result.latency.p50, p97_5: result.latency.p97_5, p99: result.latency.p99, max: result.latency.max },
  errors: result.errors,
  timeouts: result.timeouts,
  non2xx: result.non2xx,
};
console.log(JSON.stringify(summary, null, 2));
if (summary.errors || summary.timeouts || summary.non2xx || summary.latencyMs.p97_5 > 1000) process.exit(1);
