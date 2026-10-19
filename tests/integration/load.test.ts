import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getContext, type Context } from "@/server/auth/context";
import { saveProduct } from "@/server/ops/masters";
import { confirmPutaway, putawayQueue, receiveGoods } from "@/server/ops/inward";
import { confirmPick, createSalesOrder, dispatchOrder, generatePickList, packOrder } from "@/server/ops/outward";
import { signInAs, USERS } from "./helpers";

// 50 concurrent users each running order -> FEFO pick -> confirm -> pack -> dispatch
// on the same product at once. No errors, exact stock at the end, sane latency.
let ctx: Context;
let productId: string;

beforeAll(async () => {
  await signInAs(USERS.btManager);
  ctx = (await getContext())!;
  productId = (await saveProduct(ctx, { data: { sku: "BT-LOAD-1", name: "Load test", defaultTileCode: "BT-D-07-1" } }))
    .id;
  await receiveGoods(ctx, { lines: [{ productId, received: 180 }] });
  const line = (await putawayQueue(ctx)).find((l) => l.productId === productId)!;
  await confirmPutaway(ctx, { lineId: line.id, tileCode: "BT-D-07-1" });
});

describe("load: 50 concurrent pick/dispatch flows", () => {
  it("all succeed with exact stock and acceptable latency", async () => {
    const times: number[] = [];
    const flow = async (n: number) => {
      const t0 = performance.now();
      const so = await createSalesOrder(ctx, { customerName: `Load ${n}`, lines: [{ productId, quantity: 3 }] });
      const pick = await generatePickList(ctx, { salesOrderId: so.id });
      const line = await prisma.pickListLine.findFirstOrThrow({ where: { pickListId: pick.id } });
      await confirmPick(ctx, { lineId: line.id, tileCode: "BT-D-07-1", quantity: 3 });
      await packOrder(ctx, { salesOrderId: so.id });
      await dispatchOrder(ctx, { salesOrderId: so.id, vehicleNo: "MH01LOAD01" });
      times.push(performance.now() - t0);
    };
    const results = await Promise.allSettled(Array.from({ length: 50 }, (_, i) => flow(i)));
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(failed.map((f) => String(f.reason))).toEqual([]);
    const left = await prisma.stockBalance.aggregate({ where: { productId }, _sum: { quantity: true } });
    expect(left._sum.quantity).toBe(180 - 150);
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    console.log(
      JSON.stringify({
        flows: 50,
        p50ms: Math.round(times[25]),
        p95ms: Math.round(p95),
        maxMs: Math.round(times.at(-1)!),
      }),
    );
    expect(p95).toBeLessThan(30_000);
  }, 120_000);
});
