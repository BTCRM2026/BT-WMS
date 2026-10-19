import { apiRoute, HttpError } from "@/server/auth/context";
import { toPdf, toXlsx } from "@/server/export";
import { parsePeriod, runReport } from "@/server/reports";

// GET /api/reports/<key>?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|xlsx|pdf
export const GET = apiRoute<{ key: string }>("reports.view", async (ctx, req, { key }) => {
  const q = new URL(req.url).searchParams;
  const period = parsePeriod(q.get("from"), q.get("to"));
  const report = await runReport(ctx, key, period);
  if (!report) throw new HttpError(404, "Unknown report");
  const format = q.get("format") ?? "json";
  const meta = {
    company: ctx.company.name,
    period: `${period.from.toISOString().slice(0, 10)} to ${period.to.toISOString().slice(0, 10)}`,
  };
  const name = `${ctx.company.slug}-${key}-${period.to.toISOString().slice(0, 10)}`;
  if (format === "xlsx")
    return new Response(new Uint8Array(await toXlsx([report], meta)), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${name}.xlsx"`,
        "cache-control": "private, no-store",
      },
    });
  if (format === "pdf")
    return new Response(new Uint8Array(await toPdf(report, meta)), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${name}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  return report;
});
