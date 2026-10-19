import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { getContext } from "@/server/auth/context";
import { digestText, raiseAlerts, runDailyDigest, type Notifier } from "@/server/alerts";
import { globalSearch, lookupCode } from "@/server/search";
import { saveProduct } from "@/server/ops/masters";
import { middleware } from "@/middleware";
import { GET as attachmentRoute } from "@/app/api/attachments/[id]/route";
import { GET as challanRoute } from "@/app/api/dispatches/[id]/challan/route";
import { GET as reportRoute } from "@/app/api/reports/[key]/route";
import { GET as labelsRoute } from "@/app/api/labels/route";
import { POST as cronRoute } from "@/app/api/cron/daily/route";
import { callRoute, companies, signInAs, signOut, USERS } from "./helpers";

const DAY = 86_400_000;
let bt: { id: string };
let rf: { id: string };
beforeAll(async () => {
  ({ bt, rf } = await companies());
});

describe("alerts fire exactly once", () => {
  it("low stock and expiry alerts are raised once, however often the job runs", async () => {
    const first = await raiseAlerts(bt.id);
    expect(first.length).toBeGreaterThan(0);
    expect(first.some((a) => a.kind === "low-stock")).toBe(true);
    expect(first.some((a) => a.kind.startsWith("expiry-"))).toBe(true);
    expect(await raiseAlerts(bt.id)).toEqual([]);
    expect(await raiseAlerts(bt.id)).toEqual([]);
  });

  it("an expiring batch fires again only when it crosses a tighter threshold", async () => {
    const now = new Date();
    const b = await prisma.batch.findFirstOrThrow({
      where: { companyId: bt.id, expiryDate: { gt: new Date(now.getTime() + 95 * DAY) } },
      orderBy: { expiryDate: "asc" },
    });
    const days = Math.ceil((b.expiryDate!.getTime() - now.getTime()) / DAY);
    const at = (d: number) => new Date(b.expiryDate!.getTime() - d * DAY);
    expect((await raiseAlerts(bt.id, at(80))).filter((a) => a.key === b.id).map((a) => a.kind)).toEqual(["expiry-90"]);
    expect((await raiseAlerts(bt.id, at(70))).filter((a) => a.key === b.id)).toEqual([]);
    expect((await raiseAlerts(bt.id, at(45))).filter((a) => a.key === b.id).map((a) => a.kind)).toEqual(["expiry-60"]);
    expect((await raiseAlerts(bt.id, at(10))).filter((a) => a.key === b.id).map((a) => a.kind)).toEqual(["expiry-30"]);
    expect((await raiseAlerts(bt.id, at(5))).filter((a) => a.key === b.id)).toEqual([]);
    expect(days).toBeGreaterThan(95);
  });

  it("the daily digest runs once per day and sends through the adapter", async () => {
    await prisma.companySetting.upsert({
      where: { companyId: rf.id },
      update: { digestRecipients: "owner@example.com" },
      create: { companyId: rf.id, digestRecipients: "owner@example.com" },
    });
    const sent: { to: string[]; subject: string; text: string }[] = [];
    const notifier: Notifier = { send: async (m) => void sent.push(m) };
    const day = new Date("2031-01-15T03:00:00Z");
    const [a, b] = await Promise.all([runDailyDigest(day, notifier), runDailyDigest(day, notifier)]);
    expect([a.skipped, b.skipped].sort()).toEqual([false, true]);
    expect((await runDailyDigest(day, notifier)).skipped).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(["owner@example.com"]);
    expect(sent[0].text).toContain("Rich Fill");
  });

  it("digest text is WhatsApp/email friendly", () => {
    expect(digestText("Bond Therapy", [{ kind: "low-stock", message: "BT-0001 is below minimum" }])).toBe(
      "*Bond Therapy* daily warehouse digest\n\nLow stock (1):\n- BT-0001 is below minimum",
    );
  });

  it("the cron endpoint needs the shared secret", async () => {
    process.env.CRON_SECRET = "s3cret-for-tests-only";
    const res = await cronRoute(
      new Request("http://test/api/cron/daily", { method: "POST", headers: { "x-cron-secret": "wrong" } }),
    );
    expect(res.status).toBe(403);
  });
});

describe("security", () => {
  it("SQL injection strings are just text (parameterised queries)", async () => {
    await signInAs(USERS.btAdmin);
    const ctx = (await getContext())!;
    for (const evil of [
      "' OR 1=1 --",
      "'; DROP TABLE products; --",
      '" OR ""="',
      "BT-A-01-1' UNION SELECT * FROM users --",
    ]) {
      const s = await globalSearch(ctx, evil);
      expect(Object.values(s!).flat()).toEqual([]);
      expect(await lookupCode(ctx, evil)).toBeNull();
    }
    expect(await prisma.product.count()).toBeGreaterThan(0); // still there
    signOut();
  });

  it("XSS payloads are stored as plain text and never as markup", async () => {
    await signInAs(USERS.btAdmin);
    const ctx = (await getContext())!;
    const { id } = await saveProduct(ctx, { data: { sku: "BT-XSS-1", name: '<img src=x onerror="alert(1)">' } });
    const p = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(p.name).toBe('<img src=x onerror="alert(1)">'); // React escapes it on render; CSP blocks inline handlers
    signOut();
  });

  it("CSRF: a cross-site POST to the API is rejected", () => {
    const req = new NextRequest("https://wms.example/api/products", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "wms.example", cookie: "wms_session=x" },
    });
    expect(middleware(req).status).toBe(403);
    const same = new NextRequest("https://wms.example/api/products", {
      method: "POST",
      headers: { origin: "https://wms.example", host: "wms.example", cookie: "wms_session=x" },
    });
    expect(middleware(same).status).not.toBe(403);
  });

  it("API rate limit kicks in", () => {
    let last = 200;
    for (let i = 0; i < 700; i++)
      last = middleware(
        new NextRequest("https://wms.example/api/me", {
          headers: { "x-forwarded-for": "203.0.113.9", cookie: "wms_session=x" },
        }),
      ).status;
    expect(last).toBe(429);
  });

  it("IDOR: another company's files, challans, labels and reports are not reachable", async () => {
    const rfUser = await prisma.user.findFirstOrThrow({ where: { companyId: rf.id } });
    const file = await prisma.attachment.create({
      data: {
        companyId: rf.id,
        entity: "inward_receipt",
        entityId: "x",
        fileName: "p.png",
        mimeType: "image/png",
        size: 4,
        data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        uploadedById: rfUser.id,
      },
    });
    const so = await prisma.salesOrder.findFirst({ where: { companyId: rf.id } });
    // Unauthenticated: 401.
    expect((await callRoute(attachmentRoute as never, "http://test", { id: file.id })).status).toBe(401);
    await signInAs(USERS.btAdmin);
    expect((await callRoute(attachmentRoute as never, "http://test", { id: file.id })).status).toBe(404);
    const d = so ? await prisma.dispatch.findFirst({ where: { salesOrderId: so.id } }) : null;
    if (d) expect((await callRoute(challanRoute as never, "http://test", { id: d.id })).status).toBe(404);
    const rfTile = await prisma.location.findFirstOrThrow({ where: { companyId: rf.id } });
    const labels = await callRoute(labelsRoute as never, `http://test/api/labels?kind=tile&ids=${rfTile.id}`);
    expect(Buffer.from(await labels.arrayBuffer()).toString("latin1")).not.toContain(rfTile.code);
    const rep = await callRoute(reportRoute as never, "http://test/api/reports/stock-tile", { key: "stock-tile" });
    expect(await rep.text()).not.toContain("RF-");
    signOut();
  });
});
