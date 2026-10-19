"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, Field, Input } from "@/components/ui/primitives";
import { saveSettingsAction } from "./actions";

type V = { writeOffApproval: boolean; countApproval: boolean; lockedBefore: string; digestRecipients: string };

export function SettingsForm({ initial }: { initial: V }) {
  const t = useTranslations("settings");
  const [v, setV] = useState(initial);
  const { run, pending, error } = useSubmit();
  const box = (k: "writeOffApproval" | "countApproval") => (
    <label className="flex min-h-11 items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={v[k]}
        onChange={(e) => setV({ ...v, [k]: e.target.checked })}
        className="mt-0.5 size-5 accent-[var(--primary)]"
      />
      <span>
        <span className="font-medium">{t(`${k}`)}</span>
        <span className="block text-muted">{t(`${k}Hint`)}</span>
      </span>
    </label>
  );
  return (
    <Card className="p-4 sm:p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(saveSettingsAction, v, { success: t("saved") });
        }}
      >
        <h2 className="font-semibold">{t("approvals")}</h2>
        {box("writeOffApproval")}
        {box("countApproval")}
        <Field label={t("lockedBefore")} htmlFor="lock" hint={t("lockedBeforeHint")}>
          <Input
            id="lock"
            type="date"
            value={v.lockedBefore}
            onChange={(e) => setV({ ...v, lockedBefore: e.target.value })}
            className="max-w-48"
          />
        </Field>
        <Field label={t("digest")} htmlFor="digest" hint={t("digestHint")}>
          <Input
            id="digest"
            value={v.digestRecipients}
            onChange={(e) => setV({ ...v, digestRecipients: e.target.value })}
            placeholder="owner@example.com, +919800000000"
          />
        </Field>
        <FormError error={error} />
        <Button type="submit" loading={pending} className="justify-self-start">
          {t("save")}
        </Button>
      </form>
    </Card>
  );
}
