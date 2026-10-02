"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Theme: auto", light: "Theme: light", dark: "Theme: dark" };
const EVENT = "themechange";

function read(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Cycles auto → light → dark. Remembered per browser; auto follows the OS. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  const apply = (t: Theme) => {
    try {
      if (t === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch {}
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <button type="button" className="textbtn" onClick={() => apply(NEXT[theme])}>
      {LABEL[theme]}
    </button>
  );
}
