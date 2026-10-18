"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requestMeta } from "@/server/auth/context";
import { attemptLogin } from "@/server/auth/login";
import { cookieOptions, SESSION_COOKIE } from "@/server/auth/session";

const schema = z.object({
  email: z.email("emailRequired").max(254, "emailRequired"),
  password: z.string().min(1, "passwordRequired").max(128, "passwordRequired"),
  next: z.string().optional(),
});

export type LoginState = {
  error?: "invalid" | "locked" | "rate_limited" | "emailRequired" | "passwordRequired";
  email?: string;
};

// Public action (no session yet): the only one not built with action().
// Returns message keys; the form translates them (messages/en.json → login.errors).
export async function login(_prev: LoginState | undefined, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message as LoginState["error"], email };

  const result = await attemptLogin({ ...parsed.data, ...(await requestMeta()) });
  if (!result.ok) return { error: result.error, email };

  (await cookies()).set(SESSION_COOKIE, result.token, cookieOptions(result.expiresAt, (await headers()).get("host")));
  // Only same-site relative paths, never an open redirect.
  const next =
    parsed.data.next?.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/dashboard";
  redirect(next);
}
