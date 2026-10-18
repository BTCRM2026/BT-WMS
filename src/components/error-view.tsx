"use client";

import { DatabaseZap, RotateCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useState } from "react";
import { reportServerTrouble } from "@/components/connection-banner";
import { Button } from "@/components/ui/button";

/**
 * Friendly error screen. Never shows the raw error; the real one is logged on
 * the server under the same digest. Production errors are redacted, so it asks
 * /api/health whether the database is down; if so it says so and retries by
 * itself every 3s until the database is back.
 */
export function ErrorView({ error, reset: resetBoundary }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [dbDown, setDbDown] = useState(false);
  // Server-rendered pages need fresh data, not just a re-render.
  const reset = useCallback(() => startTransition(() => (router.refresh(), resetBoundary())), [router, resetBoundary]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let wasDown = false;
    const probe = async () => {
      let ok = false;
      try {
        ok = (await fetch("/api/health", { cache: "no-store" })).ok;
      } catch {}
      if (stop) return;
      if (ok) {
        if (wasDown) reset(); // recovered: reload the page data automatically
        return;
      }
      wasDown = true;
      setDbDown(true);
      reportServerTrouble();
      timer = setTimeout(probe, 3000);
    };
    probe();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [reset]);

  const Icon = dbDown ? DatabaseZap : TriangleAlert;
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center"
      data-testid="error-view"
    >
      <span className="grid size-14 place-items-center rounded-full bg-warning-soft text-warning">
        <Icon className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">{dbDown ? t("dbTitle") : t("title")}</h1>
      <p className="text-muted">{dbDown ? t("dbBody") : t("body")}</p>
      <Button onClick={reset} className="mt-2" data-testid="error-retry">
        <RotateCw /> {tc("retry")}
      </Button>
      {error.digest && <p className="text-xs text-muted">{t("reference", { id: error.digest })}</p>}
    </div>
  );
}
