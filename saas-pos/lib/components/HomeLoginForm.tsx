"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { es } from "@/lib/locale";

export function HomeLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setError("Usuario o contraseña incorrectos.");
      setLoading(false);
      return;
    }
    router.push("/mesas");
    router.refresh();
  }

  return (
    <form
      className="mt-4 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        name="email"
        className="w-full rounded-lg border border-zinc-300 p-2 text-sm"
        placeholder={es.login.emailPlaceholder}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        name="password"
        className="w-full rounded-lg border border-zinc-300 p-2 text-sm"
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
        className="btn-pos-primary mt-2 w-full rounded-lg p-2.5 text-center text-sm font-extrabold uppercase tracking-wide text-white no-underline disabled:opacity-40"
      >
        {loading ? "Entrando..." : es.home.login}
      </button>
    </form>
  );
}

