"use client";

import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/menu";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/**
 * Camera scan for any code field (browser BarcodeDetector: Chrome/Edge on
 * Android, desktop). USB scanners need nothing: they type into the field.
 */
export function ScanButton({ onCode, label = "Scan with camera" }: { onCode: (code: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices;

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        return setMsg("Camera access was blocked. Type the code instead.");
      }
      const v = video.current!;
      v.srcObject = stream;
      await v.play();
      const Ctor = (window as unknown as { BarcodeDetector: new (o?: object) => Detector }).BarcodeDetector;
      const d = new Ctor({ formats: ["qr_code", "code_128", "ean_13", "ean_8", "code_39", "upc_a"] });
      const loop = async () => {
        if (stop) return;
        try {
          const [hit] = await d.detect(v);
          if (hit?.rawValue) {
            navigator.vibrate?.(40);
            onCode(hit.rawValue.trim());
            return setOpen(false);
          }
        } catch {}
        setTimeout(loop, 200);
      };
      loop();
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onCode]);

  if (!supported) return null;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={label}
        title={label}
        onClick={() => (setMsg(null), setOpen(true))}
        className="h-auto self-stretch"
      >
        <Camera />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        {open && (
          <SheetContent side="bottom" title={label}>
            <video ref={video} playsInline muted className="aspect-[4/3] w-full rounded-md bg-black object-cover" />
            {msg && (
              <p role="alert" className="mt-2 text-sm text-warning">
                {msg}
              </p>
            )}
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
