"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("login");
  const [state, formAction, pending] = useActionState<LoginState | undefined, FormData>(login, undefined);
  const [show, setShow] = useState(false);
  const fieldError =
    state?.error === "emailRequired" ? "email" : state?.error === "passwordRequired" ? "password" : null;
  const message = state?.error ? t(`errors.${state.error}`) : null;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={t("email")} htmlFor="email" error={fieldError === "email" ? message! : undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          required
          defaultValue={state?.email}
          aria-invalid={fieldError === "email" || undefined}
          aria-describedby={fieldError === "email" ? "email-error" : undefined}
        />
      </Field>
      <Field label={t("password")} htmlFor="password" error={fieldError === "password" ? message! : undefined}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-11"
            aria-invalid={fieldError === "password" || undefined}
            aria-describedby={fieldError === "password" ? "password-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-foreground"
            aria-label={show ? t("hidePassword") : t("showPassword")}
            aria-pressed={show}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      {message && !fieldError && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {message}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {!pending && <LogIn />}
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
