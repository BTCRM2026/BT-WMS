import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { tilesWithStock } from "@/server/insights";
import { LocationsTable, ViewTabs } from "./tiles";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const ctx = await requirePage("locations.view");
  const t = await getTranslations("locations");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<ViewTabs />} />
      <LocationsTable tiles={await tilesWithStock(ctx.db)} />
    </>
  );
}
