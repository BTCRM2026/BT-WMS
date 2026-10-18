import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { Scanner } from "./scanner";

export const metadata = { title: "Scan" };

export default async function ScanPage() {
  await requirePage("stock.view");
  const t = await getTranslations("scan");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Scanner />
    </>
  );
}
