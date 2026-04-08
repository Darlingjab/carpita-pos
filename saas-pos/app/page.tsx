import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { es } from "@/lib/locale";
import { HomeLoginForm } from "@/lib/components/HomeLoginForm";

export default async function Home() {
  const store = await cookies();
  const email = store.get("pos_demo_user")?.value;
  if (email) redirect("/mesas");

  return (
    <main
      className="flex min-h-dvh min-h-screen items-center justify-center p-6"
      style={{ minHeight: "100dvh" }}
    >
      <section className="card w-full max-w-xl p-8">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo/carpita.svg"
            alt="Logo Carpita"
            width={80}
            height={80}
            unoptimized
            priority
            className="h-20 w-20 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900">
            {es.home.title} Carpita
          </h1>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-extrabold uppercase text-slate-500">Inicio de sesión</p>
            <p className="mt-1 text-sm text-slate-600">Ingresa usuario y contraseña.</p>
            <HomeLoginForm />
            <Link href="/login" className="mt-3 block text-center text-xs text-slate-500 underline">
              Abrir pantalla completa de login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
