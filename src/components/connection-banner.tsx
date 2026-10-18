"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type State = "ok" | "offline" | "reconnecting";

/** Ask the banner to re-check the server now (e.g. after a failed request). */
export const reportServerTrouble = () => window.dispatchEvent(new Event("wms:server-trouble"));

/**
 * Watches the network and /api/health. While the server or database is down it
 * shows a "reconnecting" banner and polls every 3s; when it is back it refreshes
 * the page data so nobody has to reload by hand.
 */
export function ConnectionBanner() {
  const t = useTranslations("errors");
  const router = useRouter();
  const [state, setState] = useState<State>("ok");
  const stateRef = useRef<State>("ok");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const set = (s: State) => {
      if (stateRef.current !== "ok" && s === "ok") {
        toast.success(t("reconnected"));
        router.refresh();
      }
      stateRef.current = s;
      setState(s);
    };
    const check = async () => {
      clearTimeout(timer);
      if (!navigator.onLine) set("offline");
      else {
        try {
          const r = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(5000) });
          set(r.ok ? "ok" : "reconnecting");
        } catch {
          set("reconnecting");
        }
      }
      const visible = document.visibilityState === "visible";
      timer = setTimeout(check, stateRef.current === "ok" ? (visible ? 30_000 : 120_000) : 3_000);
    };
    const now = () => void check();
    check();
    window.addEventListener("online", now);
    window.addEventListener("offline", now);
    window.addEventListener("wms:server-trouble", now);
    document.addEventListener("visibilitychange", now);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", now);
      window.removeEventListener("offline", now);
      window.removeEventListener("wms:server-trouble", now);
      document.removeEventListener("visibilitychange", now);
    };
  }, [router, t]);

  if (state === "ok") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="connection-banner"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-center text-sm font-medium text-warning"
    >
      {state === "offline" ? (
        <WifiOff className="size-4" aria-hidden />
      ) : (
        <RefreshCw className="size-4 animate-spin" aria-hidden />
      )}
      {state === "offline" ? t("offline") : t("reconnecting")}
    </div>
  );
}
