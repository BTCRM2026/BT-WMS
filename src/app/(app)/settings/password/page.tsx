"use client";

import { useState, useTransition } from "react";
import { updatePassword } from "./actions";

export default function ChangePasswordPage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();

  return (
    <form
      className="max-w-sm space-y-4"
      action={(form) =>
        start(async () => {
          const r = await updatePassword({
            current: String(form.get("current")),
            next: String(form.get("next")),
            confirm: String(form.get("confirm")),
          });
          setMsg(r.ok ? { ok: true, text: "Password changed." } : { ok: false, text: r.error });
        })
      }
    >
      <h1 className="text-2xl font-semibold">Change password</h1>
      {(["current", "next", "confirm"] as const).map((name) => (
        <label key={name} className="block text-sm">
          {{ current: "Current password", next: "New password", confirm: "Confirm new password" }[name]}
          <input
            name={name}
            type="password"
            required
            autoComplete={name === "current" ? "current-password" : "new-password"}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
      ))}
      {msg && (
        <p role="status" className={msg.ok ? "text-green-700" : "text-red-700"}>
          {msg.text}
        </p>
      )}
      <button disabled={pending} className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-60">
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
