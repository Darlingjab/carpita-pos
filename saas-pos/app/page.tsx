import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME } from "@/lib/auth";
import { verifySession } from "@/lib/session";

/**
 * Página raíz: redirige al dashboard si hay sesión activa,
 * o al login si no está autenticado.
 */
export default async function Home() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value ?? "";
  const userId = verifySession(token);
  if (userId) {
    redirect("/mesas");
  }
  redirect("/login");
}
