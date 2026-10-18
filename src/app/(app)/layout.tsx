import { AppShell } from "@/components/shell";
import { NAV_ITEMS } from "@/lib/nav";
import { switchableCompanies } from "@/server/auth/companies";
import { requirePage } from "@/server/auth/context";
import { alerts } from "@/server/insights";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePage("dashboard.view");
  const [companies, alertList] = await Promise.all([switchableCompanies(ctx), alerts(ctx.db)]);
  const pick = (c: { id: string; name: string; slug: string; brandColor: string }) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    brandColor: c.brandColor,
  });

  return (
    <AppShell
      company={pick(ctx.company)}
      companies={companies.map(pick)}
      user={{ name: ctx.user.name, email: ctx.user.email, role: ctx.user.role }}
      allowed={NAV_ITEMS.filter((i) => ctx.can(i.permission)).map((i) => i.slug)}
      alerts={alertList.slice(0, 50)}
    >
      {children}
    </AppShell>
  );
}
