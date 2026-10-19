"use client";

import { Boxes, Camera, CameraOff, ClipboardList, Grid3x3, Package, PackageCheck, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { reportServerTrouble } from "@/components/connection-banner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { fmtNumber } from "@/lib/utils";

type Result = { kind: "product" | "tile" | "batch"; title: string; sub: string; qty: number; href: string };
type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => Detector;
  }
}

const ICON = { product: Package, tile: Grid3x3, batch: Boxes };

export function Scanner() {
  const t = useTranslations("scan");
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; data: Result | null } | null>(null);

  const lookup = async (code: string) => {
    code = code.trim();
    if (!code || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/lookup?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setResult({ code, data: (await r.json()).result });
      navigator.vibrate?.(40);
    } catch {
      reportServerTrouble();
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setCamera(false);
  };
  useEffect(() => stop, []);

  const start = async () => {
    setMsg(null);
    if (!window.BarcodeDetector || !navigator.mediaDevices) return setMsg(t("notSupported"));
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch {
      return setMsg(t("denied"));
    }
    setCamera(true);
    const v = video.current!;
    v.srcObject = stream.current;
    await v.play();
    const detector = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "upc_a"],
    });
    const loop = async () => {
      if (!stream.current) return;
      try {
        const [hit] = await detector.detect(v);
        if (hit?.rawValue) {
          stop();
          if (input.current) input.current.value = hit.rawValue;
          return lookup(hit.rawValue);
        }
      } catch {}
      setTimeout(loop, 250);
    };
    loop();
  };

  const Icon = result?.data ? ICON[result.data.kind] : Search;

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <Card className="overflow-hidden">
        <div className="relative grid aspect-[4/3] place-items-center bg-surface-2">
          <video
            ref={video}
            playsInline
            muted
            className={camera ? "absolute inset-0 size-full object-cover" : "hidden"}
          />
          {camera && (
            <div
              aria-hidden
              className="absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 bg-danger/80 shadow-[0_0_12px] shadow-danger"
            />
          )}
          {!camera && <Camera className="size-12 text-muted" aria-hidden />}
        </div>
        <div className="p-4">
          {camera ? (
            <Button variant="secondary" size="lg" className="w-full" onClick={stop}>
              <CameraOff /> {t("stop")}
            </Button>
          ) : (
            <Button size="lg" className="w-full" onClick={start} data-testid="start-camera">
              <Camera /> {t("start")}
            </Button>
          )}
          {msg && (
            <p role="alert" className="mt-3 text-sm text-warning">
              {msg}
            </p>
          )}
        </div>
      </Card>

      {/* Works with USB scanners too: they type the code and press Enter. */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(input.current?.value ?? "");
        }}
      >
        <label htmlFor="scan-code" className="sr-only">
          {t("manual")}
        </label>
        <Input
          id="scan-code"
          ref={input}
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          enterKeyHint="search"
          placeholder={t("manualPlaceholder")}
          className="h-12 text-base"
        />
        <Button type="submit" size="lg" loading={busy}>
          {t("lookup")}
        </Button>
      </form>

      {result && (
        <Card className="p-4" aria-live="polite" data-testid="scan-result">
          {result.data ? (
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <Badge tone="info">{t(`found.${result.data.kind}`)}</Badge>
                <p className="mt-1 font-semibold">{result.data.title}</p>
                <p className="text-sm text-muted">{result.data.sub}</p>
                <p className="mt-2 text-sm font-medium">{t("onHand", { qty: fmtNumber(result.data.qty) })}</p>
              </div>
              <Button asChild variant="secondary">
                <Link href={result.data.href}>{t("open")}</Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm">{t("notFound", { code: result.code })}</p>
          )}
        </Card>
      )}

      <section aria-label={t("floorTasks")}>
        <h2 className="mb-2 text-sm font-semibold text-muted">{t("floorTasks")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t("pick"), Icon: ClipboardList, href: "/picking" },
            { label: t("putaway"), Icon: PackageCheck, href: "/inward/putaway" },
            { label: t("count"), Icon: Boxes, href: "/stock-audits" },
          ].map(({ label, Icon: I, href }) => (
            <Link
              key={label}
              href={href}
              className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border border-line bg-surface text-sm font-medium shadow-sm hover:bg-surface-2"
            >
              <I className="size-6 text-primary" aria-hidden />
              {label}
            </Link>
          ))}
        </div>{" "}
      </section>
    </div>
  );
}
