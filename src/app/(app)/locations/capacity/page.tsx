import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { CapacityForm } from "./capacity-form";

export const metadata = { title: "Set capacity" };

export default async function CapacityPage() {
  const ctx = await requirePage("locations.manage");
  const t = await getTranslations("ops.capacity");
  const zones = await ctx.db.location.findMany({
    where: { type: "STORAGE" },
    distinct: ["zone"],
    select: { zone: true },
    orderBy: { zone: "asc" },
  });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CapacityForm zones={zones.map((z) => z.zone)} />
    </>
  );
}
