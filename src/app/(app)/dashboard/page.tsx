import { AlertTriangle, Boxes, CalendarClock, Clock, Grid3x3, Package, ScanLine } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { buttonVariants } from "@/components/ui/button";
import { cn, fmtDate, fmtNumber } from "@/lib/utils";
import { requirePage } from "@/server/auth/context";
import { dashboardData } from "@/server/insights";
import { ExpiryChart, TrendChart, ZoneChart } from "./charts";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const ctx = await requirePage("dashboard.view");
  const t = await getTranslations("dashboard");
  const tf = await getTranslations();
  const d = await dashboardData(ctx.db);

  const kpis = [
    { label: t("kpi.skus"), value: fmtNumber(d.kpis.skus), icon: Package, tone: "text-brand bg-brand-soft" },
    { label: t("kpi.units"), value: fmtNumber(d.kpis.units), icon: Boxes, tone: "text-success bg-success-soft" },
    {
      label: t("kpi.lowStock"),
      value: fmtNumber(d.kpis.lowStock),
      icon: AlertTriangle,
      tone: "text-warning bg-warning-soft",
      href: "/products",
    },
    {
      label: t("kpi.nearExpiry"),
      value: fmtNumber(d.kpis.nearExpiry),
      icon: CalendarClock,
      tone: "text-danger bg-danger-soft",
      href: "/stock",
    },
    {
      label: t("kpi.tiles"),
      value: `${d.kpis.tilesUsed} / ${d.kpis.tilesTotal}`,
      icon: Grid3x3,
      tone: "text-info bg-info-soft",
      href: "/locations/map",
    },
  ];

  const quick = [
    { href: "/scan", label: t("quick.scan"), icon: ScanLine, show: true },
    { href: "/stock", label: t("quick.stock"), icon: Boxes, show: ctx.can("stock.view") },
    { href: "/locations/map", label: t("quick.map"), icon: Grid3x3, show: ctx.can("locations.view") },
    { href: "/products", label: t("quick.products"), icon: Package, show: ctx.can("products.view") },
  ].filter((q) => q.show);

  return (
    <>
      <PageHeader
        title={<span data-testid="dashboard-title">{t("title", { company: ctx.company.name })}</span>}
        subtitle={t("subtitle")}
      />

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {kpis.map((k, i) => {
          const body = (
            <Card className={cn("h-full p-4 transition-colors duration-150", k.href && "hover:border-line-strong")}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted">{k.label}</p>
                <span className={cn("grid size-8 place-items-center rounded-md", k.tone)}>
                  <k.icon className="size-4" aria-hidden />
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular">{k.value}</p>
            </Card>
          );
          return (
            <li key={k.label} className={cn(i === 0 && "col-span-2 lg:col-span-1")}>
              {k.href ? (
                <Link href={k.href} className="block h-full rounded-lg">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>

      <section aria-label={t("quick.title")} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quick.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "h-auto min-h-14 min-w-0 justify-start py-2 text-left whitespace-normal",
            )}
          >
            <q.icon className="text-primary" aria-hidden />
            {q.label}
          </Link>
        ))}
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t("charts.trend")} hint={t("charts.trendHint")} />
          <TrendChart data={d.trend} labels={{ inward: t("charts.inward"), outward: t("charts.outward") }} />
        </Card>
        <Card id="alerts">
          <CardHeader
            title={t("alerts.title")}
            action={<Badge tone={d.alerts.length ? "warning" : "success"}>{d.alerts.length}</Badge>}
          />
          {d.alerts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">{t("alerts.none")}</p>
          ) : (
            <ul
              tabIndex={0}
              aria-label={t("alerts.title")}
              className="max-h-[300px] divide-y divide-line overflow-y-auto px-4 pb-3 sm:px-5"
            >
              {d.alerts.slice(0, 30).map((a) => (
                <li key={a.kind + a.id} className="flex gap-3 py-2.5 text-sm">
                  {a.kind === "low" ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  ) : (
                    <Clock
                      className={cn("mt-0.5 size-4 shrink-0", a.kind === "expired" ? "text-danger" : "text-warning")}
                      aria-hidden
                    />
                  )}
                  <span>
                    {a.kind === "low"
                      ? tf("dashboard.alerts.lowStock", { name: a.name, qty: a.qty, min: a.min })
                      : tf(`dashboard.alerts.${a.kind}`, { name: a.name, batch: a.batch, date: fmtDate(a.date) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={t("charts.byZone")} hint={t("charts.byZoneHint")} />
          <ZoneChart data={d.zones.map((z) => ({ ...z, label: t("charts.zone", { zone: z.zone }) }))} />
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title={t("charts.expiry")} hint={t("charts.expiryHint")} />
          <ExpiryChart data={d.expiry} />
        </Card>
      </div>
    </>
  );
}
