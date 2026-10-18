import { notFound } from "next/navigation";
import { requirePage } from "@/server/auth/context";
import { NAV_ITEMS } from "@/lib/nav";

// One placeholder page for every sidebar module until each is built.
export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const item = NAV_ITEMS.find((i) => i.slug === module);
  if (!item) notFound();
  await requirePage(item.permission);
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">{item.label}</h1>
      <p className="text-gray-600">This module will be built in a later step.</p>
    </div>
  );
}
