import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { getSettings } from "@/server/ops/settings";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Company settings" };

export default async function CompanySettingsPage() {
  const ctx = await requirePage("users.manage");
  const t = await getTranslations("settings");
  const s = await getSettings(ctx.db, ctx.company.id);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { company: ctx.company.name })} />
      <div className="grid max-w-2xl gap-4">
        <SettingsForm
          initial={{
            writeOffApproval: s.writeOffApproval,
            countApproval: s.countApproval,
            lockedBefore: s.lockedBefore ? s.lockedBefore.toISOString().slice(0, 10) : "",
            digestRecipients: s.digestRecipients ?? "",
          }}
        />
        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold">{t("exportTitle")}</h2>
          <p className="mt-1 mb-3 text-sm text-muted">{t("exportHint")}</p>
          { }
          <a
            href="/api/export"
            download
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            <Download className="size-4" aria-hidden /> {t("exportButton")}
          </a>
        </Card>
      </div>
    </>
  );
}
