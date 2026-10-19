"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { saveUserAction } from "../actions";

const ROLES = ["ADMIN", "WAREHOUSE_MANAGER", "STORE_KEEPER", "BILLING", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

export function UserForm({
  id,
  initial,
}: {
  id?: string;
  initial: { name: string; email: string; role: Role; isActive: boolean };
}) {
  const t = useTranslations("ops");
  const router = useRouter();
  const [v, setV] = useState({ ...initial, password: "" });
  const { run, pending, error } = useSubmit();
  return (
    <Card className="max-w-lg p-4 sm:p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            saveUserAction,
            { id, data: { ...v, password: v.password || undefined } },
            { success: t("saved"), then: () => router.push("/users") },
          );
        }}
      >
        <Field label={t("users.name")} htmlFor="name">
          <Input id="name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label={t("users.email")} htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
          />
        </Field>
        <Field label={t("users.role")} htmlFor="role">
          <select
            id="role"
            value={v.role}
            onChange={(e) => setV({ ...v, role: e.target.value as Role })}
            className="h-10 w-full rounded-md border border-line-strong bg-surface px-2 text-sm pointer-coarse:h-11"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("users.password")} htmlFor="password" hint={t("users.passwordHint")}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required={!id}
            value={v.password}
            onChange={(e) => setV({ ...v, password: e.target.value })}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={v.isActive}
            onChange={(e) => setV({ ...v, isActive: e.target.checked })}
            className="size-5 accent-[var(--primary)]"
          />
          {t("users.active")}
        </label>
        <FormError error={error} />
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            {t("save")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/users")}>
            {t("back")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
