import { ShieldX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "No access" };

export default async function Forbidden() {
  const t = await getTranslations();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
        <ShieldX className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold" data-testid="forbidden">
        {t("errors.forbiddenTitle")}
      </h1>
      <p className="max-w-sm text-muted">{t("errors.forbiddenBody")}</p>
      <Link href="/dashboard" className={buttonVariants({ className: "mt-2" })}>
        {t("common.backToDashboard")}
      </Link>
    </main>
  );
}
