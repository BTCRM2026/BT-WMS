"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/menu";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "system";
const KEY = "theme";

// Runs before first paint so there is no light flash in dark mode.
const script = `(()=>{try{var t=localStorage.getItem("${KEY}")||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

function read(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme) || "light";
  } catch {
    return "light";
  }
}

function apply(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {}
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  window.dispatchEvent(new Event("themechange"));
}

const subscribe = (cb: () => void) => {
  window.addEventListener("themechange", cb);
  return () => window.removeEventListener("themechange", cb);
};

export function ThemeToggle() {
  const t = useTranslations("topbar");
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const Icon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("toggleTheme")} data-testid="theme-toggle">
          <Icon />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuRadioGroup value={theme} onValueChange={(v) => apply(v as Theme)}>
          <MenuRadioItem value="light">{t("light")}</MenuRadioItem>
          <MenuRadioItem value="dark">{t("dark")}</MenuRadioItem>
          <MenuRadioItem value="system">{t("system")}</MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
