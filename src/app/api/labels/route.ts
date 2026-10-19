import { z } from "zod";
import { apiRoute } from "@/server/auth/context";
import { labelsPdf } from "@/server/labels";

const q = z.object({
  kind: z.enum(["product", "batch", "tile", "carton"]),
  ids: z
    .string()
    .max(40_000)
    .transform((s) => s.split(",").filter(Boolean)),
  layout: z.enum(["a4", "50x25"]).default("a4"),
  symbology: z.enum(["qr", "barcode"]).optional(),
});

// GET /api/labels?kind=tile&ids=a,b&layout=a4|50x25&symbology=qr|barcode
export const GET = apiRoute("products.view", async (ctx, req) => {
  const p = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const bytes = await labelsPdf(ctx, p.kind, p.ids, p.layout, p.symbology);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${p.kind}-labels.pdf"`,
      "cache-control": "private, no-store",
    },
  });
});
