import { Compass } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-muted">
        <Compass className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">{t("errors.notFoundTitle")}</h1>
      <p className="max-w-sm text-muted">{t("errors.notFoundBody")}</p>
      <Link href="/dashboard" className={buttonVariants({ className: "mt-2" })}>
        {t("common.backToDashboard")}
      </Link>
    </main>
  );
}
