import { apiRoute, HttpError } from "@/server/auth/context";

// Serves an uploaded photo to users of the same company only (tenant-scoped lookup).
export const GET = apiRoute<{ id: string }>("inward.view", async ({ db }, _req, { id }) => {
  const a = await db.attachment.findUnique({ where: { id } });
  if (!a) throw new HttpError(404, "Not found");
  return new Response(new Uint8Array(a.data), {
    headers: {
      "content-type": a.mimeType,
      "content-disposition": `inline; filename="${a.fileName.replace(/[^\w.-]/g, "_")}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
});
