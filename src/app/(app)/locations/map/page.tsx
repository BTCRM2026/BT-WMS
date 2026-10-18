import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { tilesWithStock } from "@/server/insights";
import { FloorMap, ViewTabs } from "../tiles";

export const metadata = { title: "Floor map" };

export default async function FloorMapPage() {
  const ctx = await requirePage("locations.view");
  const t = await getTranslations("map");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<ViewTabs />} />
      <FloorMap tiles={await tilesWithStock(ctx.db)} />
    </>
  );
}
