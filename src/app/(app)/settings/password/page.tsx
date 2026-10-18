"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Field, Input, PageHeader } from "@/components/ui/primitives";
import { updatePassword } from "./actions";

const RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;

export default function ChangePasswordPage() {
  const t = useTranslations("password");
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<{ new?: string; confirm?: string; form?: string }>({});
  // Deliberately NOT saved as a draft: passwords must never be written to browser storage.

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Card className="max-w-lg p-5 sm:p-6">
        <form
          noValidate
          className="space-y-5"
          action={(form) => {
            const v = {
              current: String(form.get("current")),
              next: String(form.get("next")),
              confirm: String(form.get("confirm")),
            };
            const e = {
              new: RULE.test(v.next) ? undefined : t("rules"),
              confirm: v.next === v.confirm ? undefined : t("mismatch"),
            };
            setErrors(e);
            if (e.new || e.confirm) return;
            start(async () => {
              const r = await updatePassword(v);
              if (r.ok) {
                toast.success(t("success"));
                (document.getElementById("pw-form") as HTMLFormElement | null)?.reset();
              } else setErrors({ form: r.error });
            });
          }}
          id="pw-form"
        >
          <Field label={t("current")} htmlFor="current">
            <Input id="current" name="current" type="password" autoComplete="current-password" required />
          </Field>
          <Field label={t("new")} htmlFor="new" hint={t("rules")} error={errors.new}>
            <Input
              id="new"
              name="next"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={!!errors.new || undefined}
              aria-describedby={errors.new ? "new-error" : "new-hint"}
            />
          </Field>
          <Field label={t("confirm")} htmlFor="confirm" error={errors.confirm}>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={!!errors.confirm || undefined}
              aria-describedby={errors.confirm ? "confirm-error" : undefined}
            />
          </Field>
          {errors.form && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {errors.form}
            </p>
          )}
          <Button type="submit" loading={pending}>
            {t("submit")}
          </Button>
        </form>
      </Card>
    </>
  );
}
