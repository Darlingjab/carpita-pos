"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { es } from "@/lib/locale";
import { defaultDashboardPath } from "@/lib/role-access";
import type { RoleName } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setError("Credenciales inválidas. Verificá tu email y contraseña.");
      setLoading(false);
      return;
    }
    const payload = (await res.json()) as { data?: { role?: RoleName } };
    const role = payload.data?.role;
    router.push(role ? defaultDashboardPath(role) : "/mesas");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Fondo decorativo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-orange-400/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo y nombre */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-sm">
            <Image
              src="/logo/carpita.svg"
              alt="Carpita"
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 drop-shadow"
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-white">Carpita POS</h1>
            <p className="mt-0.5 text-sm text-slate-400">Sistema de punto de venta</p>
          </div>
        </div>

        {/* Card de login */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm">
          <h2 className="mb-1 text-lg font-bold text-white">{es.login.title}</h2>
          <p className="mb-5 text-sm text-slate-400">Ingresá tus credenciales para continuar.</p>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Email
              </label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-400/60 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all"
                placeholder={es.login.emailPlaceholder}
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Contraseña
              </label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-400/60 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all"
                type="password"
                placeholder={es.login.passwordPlaceholder}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3">
                <p className="text-xs font-semibold text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mt-1 w-full rounded-xl bg-orange-500 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3 3 3H4z" />
                  </svg>
                  Ingresando…
                </span>
              ) : (
                es.home.login
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} Carpita · Sistema POS
        </p>
      </div>
    </main>
  );
}
