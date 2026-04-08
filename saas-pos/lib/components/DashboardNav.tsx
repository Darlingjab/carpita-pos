"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { dashboardRoutes, isNavActive } from "@/lib/nav/dashboard-routes";
import type { RoleName } from "@/lib/types";
import { canAccessPath } from "@/lib/role-access";
import { es } from "@/lib/locale";

function linkActive(pathname: string, href: string) {
  if (href === "/ventas") {
    return pathname === "/ventas";
  }
  return isNavActive(pathname, href);
}

export function DashboardNav({ role, enabled = true }: { role: RoleName; enabled?: boolean }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanLeft(scrollLeft > 4);
    setCanRight(maxScroll > 4 && scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = navRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [pathname, updateScrollState, role]);

  return (
    <div className="relative flex min-w-0 flex-1 flex-col justify-center">
      <span className="sr-only">{es.nav.tabsScrollHint}</span>
      {canLeft && (
        <div
          className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-white via-white/85 to-transparent sm:w-9"
          aria-hidden
        />
      )}
      {canRight && (
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-white via-white/85 to-transparent sm:w-9"
          aria-hidden
        />
      )}
      <nav
        ref={navRef}
        className="nav-tabs-scroll flex h-12 min-w-0 flex-nowrap items-stretch overflow-x-auto overflow-y-hidden scroll-smooth bg-white/40"
        aria-label="Secciones"
        style={{ touchAction: "pan-x" }}
      >
        {dashboardRoutes.map(({ href, label, icon: Icon }, index) => {
          const allowed = canAccessPath(role, href, { enabled });
          const active = linkActive(pathname, href);
          const disabled = !allowed;
          const isLast = index === dashboardRoutes.length - 1;
          const separator = isLast
            ? ""
            : active
              ? "border-r border-white/20"
              : "border-r border-slate-400/18";
          return (
            <Link
              key={href}
              href={disabled ? "#" : href}
              onClick={(e) => {
                if (disabled) e.preventDefault();
              }}
              title={disabled ? "No disponible para tu perfil" : undefined}
              aria-disabled={disabled}
              className={`relative flex min-w-max shrink-0 snap-start items-center gap-1 px-2 py-0 transition-[background-color,color,box-shadow] duration-200 ease-out sm:gap-1.5 sm:px-2.5 ${
                active
                  ? "bg-[var(--pos-primary)] text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]"
                  : disabled
                    ? "cursor-not-allowed bg-slate-50 text-slate-400"
                    : "text-slate-700 hover:bg-slate-100/70 active:bg-slate-100"
              } ${separator}`}
            >
              <Icon
                className={`hidden shrink-0 sm:block sm:h-[15px] sm:w-[15px] ${active ? "text-white/95" : "text-slate-500"}`}
                strokeWidth={2}
                aria-hidden
              />
              <span className="whitespace-nowrap text-[0.62rem] font-extrabold uppercase leading-tight tracking-wide sm:text-[0.68rem]">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
