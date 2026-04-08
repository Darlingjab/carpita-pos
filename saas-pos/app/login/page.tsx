"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      setError("Credenciales inválidas.");
      setLoading(false);
      return;
    }
    const payload = (await res.json()) as { data?: { role?: RoleName } };
    const role = payload.data?.role;
    router.push(role ? defaultDashboardPath(role) : "/mesas");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="card w-full max-w-md p-6">
        <h2 className="text-2xl font-semibold">{es.login.title}</h2>
        <p className="mt-2 text-sm text-zinc-600">Ingresa tus credenciales para continuar.</p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            placeholder={es.login.emailPlaceholder}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            type="password"
            placeholder={es.login.passwordPlaceholder}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs font-bold text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-pos-primary w-full p-2.5 text-sm font-extrabold uppercase tracking-wide disabled:opacity-40"
          >
            {loading ? "Entrando..." : es.home.login}
          </button>
        </form>
      </section>
    </main>
  );
}
