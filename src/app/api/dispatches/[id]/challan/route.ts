import { apiRoute } from "@/server/auth/context";
import { challanPdf } from "@/server/ops/challan";

export const GET = apiRoute<{ id: string }>("dispatch.view", async (ctx, _req, { id }) => {
  const { bytes, fileName } = await challanPdf(ctx, id);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${fileName}"`,
      "cache-control": "private, no-store",
    },
  });
});
