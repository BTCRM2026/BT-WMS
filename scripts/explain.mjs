// Prints EXPLAIN ANALYZE for the heaviest queries. Usage: DATABASE_URL=... node scripts/explain.mjs
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const company = (await db.company.findFirstOrThrow()).id;
const product = (await db.product.findFirstOrThrow({ where: { companyId: company } })).id;
const queries = {
  "balance for one product (trigger / FEFO)": `SELECT coalesce(sum(direction*quantity),0) FROM stock_movements WHERE company_id='${company}' AND product_id='${product}'`,
  "stock_balance for a company": `SELECT * FROM stock_balance WHERE company_id='${company}'`,
  "ledger last 30 days": `SELECT * FROM stock_movements WHERE company_id='${company}' AND created_at > now() - interval '30 days' ORDER BY created_at DESC LIMIT 1000`,
  "expiring batches": `SELECT * FROM batches WHERE company_id='${company}' AND expiry_date < now() + interval '90 days'`,
};
for (const [name, sql] of Object.entries(queries)) {
  const plan = await db.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`);
  console.log(`\n== ${name}\n${plan.map((r) => r["QUERY PLAN"]).join("\n")}`);
}
await db.$disconnect();
