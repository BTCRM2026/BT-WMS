"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { action } from "@/server/action";
import { HttpError } from "@/server/auth/context";
import { changePassword } from "@/server/auth/change-password";
import { cookieOptions, SESSION_COOKIE } from "@/server/auth/session";

const schema = z
  .object({ current: z.string().min(1, "Enter your current password."), next: z.string(), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: "New passwords do not match." });

export const updatePassword = action("authenticated", async (ctx, input: z.input<typeof schema>) => {
  const v = schema.parse(input);
  const r = await changePassword(ctx, v.current, v.next);
  if ("error" in r) throw new HttpError(400, r.error);
  // Old sessions are now invalid; keep this browser signed in with a fresh one.
  (await cookies()).set(SESSION_COOKIE, r.token, cookieOptions(r.expiresAt, (await headers()).get("host")));
  return true;
});
