import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { TileForms } from "./tile-forms";

export default async function NewTilesPage() {
  const ctx = await requirePage("locations.manage");
  const t = await getTranslations("ops.tileForm");
  return (
    <>
      <PageHeader title={t("newTitle")} />
      <TileForms companyCode={ctx.company.code} />
    </>
  );
}
