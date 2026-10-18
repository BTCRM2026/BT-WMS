import { Construction } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { NAV_ITEMS } from "@/lib/nav";
import { requirePage } from "@/server/auth/context";

// One placeholder page for every sidebar module until each is built.
export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const item = NAV_ITEMS.find((i) => i.slug === slug);
  if (!item) notFound();
  await requirePage(item.permission);
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t(`nav.items.${slug}`)} />
      <Card>
        <EmptyState
          icon={<Construction />}
          title={t("common.comingSoon")}
          body={t("common.comingSoonHint")}
          action={
            <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
              {t("common.backToDashboard")}
            </Link>
          }
        />
      </Card>
    </>
  );
}
