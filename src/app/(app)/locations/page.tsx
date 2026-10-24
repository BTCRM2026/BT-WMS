import { Boxes, Plus, Printer } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { tilesWithStock } from "@/server/insights";
import { LocationsTable, ViewTabs } from "./tiles";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const ctx = await requirePage("locations.view");
  const t = await getTranslations("locations");
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
              <Link href="/locations/capacity" className={buttonVariants({ variant: "secondary" })}>
                <Boxes /> {to("capacity.title")}
              </Link>
            )}
            {ctx.can("locations.manage") && (
              <Link href="/locations/new" className={buttonVariants()}>
                <Plus /> {to("tileForm.newTitle")}
              </Link>
            )}
          </>
        }
      />
      <LocationsTable tiles={await tilesWithStock(ctx.db)} canManage={ctx.can("locations.manage")} />
    </>
  );
}
