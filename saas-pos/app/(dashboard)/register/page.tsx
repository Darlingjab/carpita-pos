import { redirect } from "next/navigation";

/** La caja vive en Ventas → Arqueos de caja. */
export default function RegisterPage() {
  redirect("/ventas?tab=arqueos");
}
