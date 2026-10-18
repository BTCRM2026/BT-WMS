"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requestMeta } from "@/server/auth/context";
import { attemptLogin } from "@/server/auth/login";
import { cookieOptions, SESSION_COOKIE } from "@/server/auth/session";

const schema = z.object({
  email: z.email("Enter a valid email.").max(254),
  password: z.string().min(1, "Enter your password.").max(128),
  next: z.string().optional(),
});

const MESSAGES = {
  invalid: "Email or password is incorrect.",
  locked: "Too many failed attempts. Your account is locked for 15 minutes.",
  rate_limited: "Too many attempts from this network. Please wait a few minutes.",
};

// Public action (no session yet): the only one not built with action().
export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await attemptLogin({ ...parsed.data, ...(await requestMeta()) });
  if (!result.ok) return { error: MESSAGES[result.error] };

  (await cookies()).set(SESSION_COOKIE, result.token, cookieOptions(result.expiresAt));
  // Only same-site relative paths, never an open redirect.
  const next =
    parsed.data.next?.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/dashboard";
  redirect(next);
}
