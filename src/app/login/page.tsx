import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme";
import { getContext } from "@/server/auth/context";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getContext()) redirect("/dashboard");
  const { next } = await searchParams;
  const t = await getTranslations();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(480px,560px)]">
      <aside className="relative hidden overflow-hidden bg-hero p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]"
        />
        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="" width={40} height={40} className="size-10 rounded-lg ring-1 ring-white/20" />
          <span className="text-lg font-semibold">{t("app.name")}</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold">{t("login.heroTitle")}</h2>
          <p className="mt-3 text-white/75">{t("login.heroBody")}</p>
          <div className="mt-8 flex gap-3">
            {["bond-therapy", "rich-fill"].map((slug) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={slug}
                src={`/brands/${slug}.svg`}
                alt={slug === "bond-therapy" ? "Bond Therapy" : "Rich Fill"}
                width={44}
                height={44}
                className="size-11 rounded-lg ring-1 ring-white/20"
              />
            ))}
          </div>
        </div>
        <p className="relative flex items-center gap-2 text-sm text-white/70">
          <ShieldCheck className="size-4" aria-hidden /> {t("login.footer")}
        </p>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.svg" alt="" width={36} height={36} className="size-9 rounded-lg" />
            <span className="text-lg font-semibold">{t("app.name")}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
          <p className="mt-1.5 mb-8 text-sm text-muted">{t("login.subtitle")}</p>
          <LoginForm next={next} />
          <p className="mt-8 flex items-center gap-2 text-xs text-muted lg:hidden">
            <ShieldCheck className="size-4" aria-hidden /> {t("login.footer")}
          </p>
        </div>
      </main>
    </div>
  );
}
