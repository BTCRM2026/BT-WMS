import { Plus, Printer } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { tilesWithStock } from "@/server/insights";
import { FloorMap, ViewTabs } from "../tiles";

export const metadata = { title: "Floor map" };

export default async function FloorMapPage() {
  const ctx = await requirePage("locations.view");
  const t = await getTranslations("map");
  const to = await getTranslations("ops");
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <ViewTabs />
            <Link href="/locations/print" className={buttonVariants({ variant: "secondary" })}>
              <Printer /> {to("tileForm.print")}
            </Link>
            {ctx.can("locations.manage") && (
              <Link href="/locations/new" className={buttonVariants()}>
                <Plus /> {to("tileForm.newTitle")}
              </Link>
            )}
          </>
        }
      />
      <FloorMap tiles={await tilesWithStock(ctx.db)} canManage={ctx.can("locations.manage")} />
    </>
  );
}
