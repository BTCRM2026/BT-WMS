import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { IMPORT_COLUMNS } from "@/server/ops/masters";
import { Importer } from "./importer";

export default async function ImportPage() {
  await requirePage("products.manage");
  const t = await getTranslations("ops.import");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Importer columns={[...IMPORT_COLUMNS]} />
    </>
  );
}
