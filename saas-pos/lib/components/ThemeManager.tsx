"use client";

import { useEffect } from "react";

const STORAGE_KEY = "pos_theme_v1";

/**
 * Cliente que aplica el tema guardado en localStorage al elemento <html>.
 * Debe montarse una sola vez en el layout principal.
 */
export function ThemeManager() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const theme = saved === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
    } catch {
      /* localStorage no disponible */
    }

    function onUpdate(e: Event) {
      const next = (e as CustomEvent<{ theme: "light" | "dark" }>).detail?.theme ?? "light";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    }

    window.addEventListener("pos-theme-changed", onUpdate);
    return () => window.removeEventListener("pos-theme-changed", onUpdate);
  }, []);

  return null;
}

/** Helper externo para que otros componentes puedan disparar el cambio. */
export function setTheme(theme: "light" | "dark") {
  window.dispatchEvent(new CustomEvent("pos-theme-changed", { detail: { theme } }));
}

export function getCurrentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
