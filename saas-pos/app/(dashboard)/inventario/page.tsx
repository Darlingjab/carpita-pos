import { redirect } from "next/navigation";

export default function InventarioPage() {
  redirect("/products?tab=inventario");
}
