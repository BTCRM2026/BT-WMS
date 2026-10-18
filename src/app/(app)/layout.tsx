import Link from "next/link";
import { requirePage } from "@/server/auth/context";
import { switchableCompanies } from "@/server/auth/companies";
import { NAV } from "@/lib/nav";
import { logout } from "./actions";
import { CompanySwitcher } from "./company-switcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePage("dashboard.view");
  const companies = await switchableCompanies(ctx);

  return (
    <div className="flex min-h-screen" style={{ ["--brand" as string]: ctx.company.brandColor }}>
      <aside className="w-56 shrink-0 border-r bg-white p-4">
        <div className="mb-4 font-semibold" style={{ color: "var(--brand)" }} data-testid="company-name">
          {ctx.company.name}
        </div>
        <nav className="space-y-4 text-sm">
          <Link href="/dashboard" className="block">
            Dashboard
          </Link>
          {NAV.map((g) => {
            const items = g.items.filter((i) => ctx.can(i.permission));
            if (!items.length) return null;
            return (
              <div key={g.label}>
                <div className="mb-1 text-xs uppercase text-gray-500">{g.label}</div>
                {items.map((i) => (
                  <Link key={i.slug} href={`/${i.slug}`} className="block py-0.5">
                    {i.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-end gap-4 border-b bg-white px-4 py-2 text-sm">
          {companies.length > 1 && (
            <CompanySwitcher companies={companies.map((c) => ({ id: c.id, name: c.name }))} activeId={ctx.company.id} />
          )}
          <span data-testid="user-role">
            {ctx.user.name} · {ctx.user.role}
          </span>
          <Link href="/settings/password">Change password</Link>
          <form action={logout}>
            <button className="text-blue-700">Sign out</button>
          </form>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
