"use client";

import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Grid3x3,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MoreHorizontal,
  Boxes,
  ScanLine,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { logout, switchCompany } from "@/app/(app)/actions";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/menu";
import { NAV, NAV_ITEMS } from "@/lib/nav";
import { cn, fmtDate } from "@/lib/utils";
import type { Alert } from "@/server/insights";

type Company = { id: string; name: string; slug: string; brandColor: string };
type ShellProps = {
  company: Company;
  companies: Company[];
  user: { name: string; email: string; role: string };
  allowed: string[];
  alerts: Alert[];
  children: React.ReactNode;
};

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

function Logo({ company, compact }: { company: Company; compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="flex min-w-0 items-center gap-2.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
      aria-label={company.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brands/${company.slug}.svg`} alt="" width={32} height={32} className="size-8 shrink-0 rounded-md" />
      {!compact && (
        <span className="truncate text-[15px] font-semibold" data-testid="company-name">
          {company.name}
        </span>
      )}
    </Link>
  );
}

function NavLinks({
  allowed,
  collapsed,
  onNavigate,
}: {
  allowed: string[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const path = usePathname();
  // The most specific matching link wins (/inward/putaway over /inward).
  const hrefs = ["/dashboard", "/scan", ...NAV_ITEMS.filter((i) => allowed.includes(i.slug)).map((i) => `/${i.slug}`)];
  const activeHref = hrefs.filter((h) => isActive(path, h)).sort((a, b) => b.length - a.length)[0];
  const link = (href: string, label: string, Icon: React.ElementType) => {
    const active = href === activeHref;
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={cn(
          "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-foreground pointer-coarse:h-11",
          active && "bg-brand-soft font-medium text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand" />}
        <Icon className={cn("size-[18px] shrink-0", active && "text-brand")} aria-hidden />
        <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
      </Link>
    );
  };
  return (
    <nav aria-label={t("mainNav")} className="space-y-5">
      <div className="space-y-0.5">
        {link("/dashboard", t("dashboard"), LayoutDashboard)}
        {link("/scan", t("scan"), ScanLine)}
      </div>
      {NAV.map((g) => {
        const items = g.items.filter((i) => allowed.includes(i.slug));
        if (!items.length) return null;
        return (
          <div key={g.key} className="space-y-0.5">
            <div
              className={cn(
                "px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase",
                collapsed && "sr-only",
              )}
            >
              {t(`groups.${g.key}`)}
            </div>
            {items.map((i) => link(`/${i.slug}`, t(`items.${i.slug}`), i.icon))}
          </div>
        );
      })}
    </nav>
  );
}

function Breadcrumbs() {
  const t = useTranslations("nav");
  const path = usePathname();
  const slug = path.split("/")[1];
  const item = NAV_ITEMS.find((i) => i.slug === slug);
  const group = NAV.find((g) => g.items.includes(item!));
  const label = item ? t(`items.${slug}`) : slug === "scan" ? t("scan") : slug === "dashboard" ? t("dashboard") : null;
  return (
    <nav aria-label={t("breadcrumb")} className="hidden min-w-0 items-center gap-1.5 text-sm text-muted md:flex">
      <Link href="/dashboard" className="hover:text-foreground">
        {t("home")}
      </Link>
      {group && (
        <>
          <span aria-hidden>/</span>
          <span>{t(`groups.${group.key}`)}</span>
        </>
      )}
      {label && slug !== "dashboard" && (
        <>
          <span aria-hidden>/</span>
          <span className="truncate font-medium text-foreground" aria-current="page">
            {label}
          </span>
        </>
      )}
    </nav>
  );
}

function CompanySwitcher({ company, companies }: { company: Company; companies: Company[] }) {
  const t = useTranslations("topbar");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          loading={pending}
          data-testid="company-switcher"
          aria-label={`${t("switchCompany")}: ${company.name}`}
          className="max-sm:size-10 max-sm:px-0"
        >
          {!pending && <Building2 aria-hidden />}
          <span className="hidden max-w-40 truncate sm:inline">{company.name}</span>
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{t("switchCompany")}</MenuLabel>
        {companies.map((c) => (
          <MenuItem
            key={c.id}
            data-testid={`switch-${c.slug}`}
            onSelect={() =>
              start(async () => {
                if (c.id === company.id) return;
                const r = await switchCompany(c.id);
                if (r.ok) {
                  router.refresh();
                  toast.success(c.name);
                } else toast.error(r.error);
              })
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/brands/${c.slug}.svg`} alt="" width={20} height={20} className="size-5 rounded" />
            <span className="flex-1">{c.name}</span>
            {c.id === company.id && <Check className="!text-primary" aria-hidden />}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function Notifications({ alerts }: { alerts: Alert[] }) {
  const t = useTranslations();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell aria-hidden />
          <span className="sr-only">{`${t("topbar.notifications")} (${alerts.length})`}</span>
          {alerts.length > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-background tabular"
            >
              {alerts.length > 9 ? "9+" : alerts.length}
            </span>
          )}
        </Button>
      </MenuTrigger>
      <MenuContent className="w-80">
        <MenuLabel>{t("topbar.notifications")}</MenuLabel>
        {alerts.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted">{t("topbar.noNotifications")}</p>
        )}
        {alerts.slice(0, 8).map((a) => (
          <MenuItem key={a.kind + a.id} asChild>
            <Link href={a.kind === "low" ? "/products" : "/stock"} className="items-start">
              {a.kind === "low" ? (
                <AlertTriangle className="mt-0.5 !text-warning" />
              ) : (
                <Clock className={cn("mt-0.5", a.kind === "expired" ? "!text-danger" : "!text-warning")} />
              )}
              <span className="text-sm leading-snug">
                {a.kind === "low"
                  ? t("dashboard.alerts.lowStock", { name: a.name, qty: a.qty, min: a.min })
                  : t(`dashboard.alerts.${a.kind}`, { name: a.name, batch: a.batch, date: fmtDate(a.date) })}
              </span>
            </Link>
          </MenuItem>
        ))}
        {alerts.length > 8 && (
          <>
            <MenuSeparator />
            <MenuItem asChild>
              <Link href="/dashboard#alerts" className="justify-center text-primary">
                {t("common.viewAll")}
              </Link>
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

function UserMenu({ user, company }: { user: ShellProps["user"]; company: Company }) {
  const t = useTranslations("topbar");
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          aria-label={`${initials}, ${t("userMenu")}`}
          className="grid size-9 place-items-center rounded-full bg-brand text-xs font-semibold text-white pointer-coarse:size-11"
          data-testid="user-menu"
        >
          <span aria-hidden>{initials}</span>
        </button>
      </MenuTrigger>
      <MenuContent className="w-64">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
          <p className="mt-1 text-xs text-muted" data-testid="user-role">
            {user.role.replace("_", " ")} · {company.name}
          </p>
        </div>
        <MenuSeparator />
        <MenuItem asChild>
          <Link href="/settings/password">
            <KeyRound /> {t("changePassword")}
          </Link>
        </MenuItem>
        <MenuItem onSelect={() => void logout()} data-testid="sign-out">
          <LogOut /> {t("signOut")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function BottomNav({ allowed, onMore }: { allowed: string[]; onMore: () => void }) {
  const t = useTranslations("nav");
  const path = usePathname();
  const items = [
    { href: "/dashboard", label: t("dashboard"), Icon: LayoutDashboard, show: true },
    { href: "/stock", label: t("items.stock"), Icon: Boxes, show: allowed.includes("stock") },
    { href: "/scan", label: t("scan"), Icon: ScanLine, show: true, primary: true },
    { href: "/locations/map", label: t("floorMap"), Icon: Grid3x3, show: allowed.includes("locations") },
  ].filter((i) => i.show);
  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map(({ href, label, Icon, primary }) => {
          const active = isActive(path, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted",
                  active && "font-medium text-brand",
                )}
              >
                <span
                  className={cn(
                    "grid place-items-center rounded-full",
                    primary ? "size-9 bg-primary text-on-primary" : "size-6",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            onClick={onMore}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] text-muted"
          >
            <span className="grid size-6 place-items-center">
              <MoreHorizontal className="size-5" aria-hidden />
            </span>
            {t("more")}
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function AppShell({ company, companies, user, allowed, alerts, children }: ShellProps) {
  const t = useTranslations();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar") === "collapsed");
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  };

  return (
    <div className="brand-scope flex min-h-dvh" style={{ ["--brand-base" as string]: company.brandColor }}>
      <a
        href="#main"
        className="sr-only z-[70] rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      {/* Desktop / tablet sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface print:hidden transition-[width] duration-200 ease-[var(--ease-standard)] md:flex",
          collapsed ? "w-16" : "w-16 lg:w-64",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-line px-3", !collapsed && "lg:px-4")}>
          <span className={cn("hidden", !collapsed && "lg:block")}>
            <Logo company={company} />
          </span>
          <span className={cn("mx-auto", !collapsed && "lg:hidden")}>
            <Logo company={company} compact />
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <div className={cn(!collapsed && "lg:hidden")}>
            <NavLinks allowed={allowed} collapsed />
          </div>
          <div className={cn("hidden", !collapsed && "lg:block")}>
            <NavLinks allowed={allowed} />
          </div>
        </div>
        <button
          onClick={toggle}
          className="hidden h-11 items-center justify-center gap-2 border-t border-line text-sm text-muted hover:text-foreground lg:flex"
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 print:hidden items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur sm:px-4">
          <Sheet open={mobileNav} onOpenChange={setMobileNav}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("nav.openMenu")}>
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" title={company.name}>
              <NavLinks allowed={allowed} onNavigate={() => setMobileNav(false)} />
            </SheetContent>
          </Sheet>
          <span className="md:hidden">
            <Logo company={company} compact />
          </span>
          <Breadcrumbs />

          <form action="/search" role="search" className="relative ml-auto hidden w-full max-w-sm lg:block">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              name="q"
              type="search"
              aria-label={t("common.search")}
              placeholder={t("topbar.searchPlaceholder")}
              className="h-9 w-full rounded-md border border-line bg-surface-2 pr-3 pl-9 text-sm placeholder:text-muted"
            />
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ml-2">
            <Button asChild variant="ghost" size="icon" className="lg:hidden" aria-label={t("common.search")}>
              <Link href="/search">
                <Search />
              </Link>
            </Button>
            {companies.length > 1 && <CompanySwitcher company={company} companies={companies} />}
            <Notifications alerts={alerts} />
            <ThemeToggle />
            <UserMenu user={user} company={company} />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-10 lg:px-8">
          {children}
        </main>
      </div>

      <BottomNav allowed={allowed} onMore={() => setMobileNav(true)} />
    </div>
  );
}
