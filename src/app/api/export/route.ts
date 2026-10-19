import { apiRoute } from "@/server/auth/context";
import { audit } from "@/server/audit";
import { exportCompany } from "@/server/export-all";

// Everything this company owns, one sheet per table (ADMIN / owner).
export const GET = apiRoute("users.manage", async (ctx) => {
  const bytes = await exportCompany(ctx);
  await audit({ ...ctx.auditMeta, action: "data.export", entity: "company", entityId: ctx.company.id });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${ctx.company.slug}-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
});
