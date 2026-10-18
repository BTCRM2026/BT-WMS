"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="w-full rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
