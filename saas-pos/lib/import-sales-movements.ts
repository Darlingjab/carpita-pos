import type { RegisterMovement, Sale } from "@/lib/types";

/** Líneas de «movimiento de caja» sintéticas solo desde ventas del reporte importado (no POS). */
export function salesToImportedRegisterMovements(sales: Sale[]): RegisterMovement[] {
  const rows: RegisterMovement[] = [];
  for (const s of sales) {
    const payParts =
      (s.payments ?? [])
        .map((p) => {
          const tag = p.method === "cash" ? "Efe" : p.method === "card" ? "Tarj" : "Transf";
          return `${tag} $${Number(p.amount).toFixed(2)}`;
        })
        .join(" · ") || "—";
    rows.push({
      id: `mov_imp_${s.id}`,
      businessId: s.businessId,
      type: "in",
      amount: Number(s.total) || 0,
      note: `Venta importada · ${payParts}`,
      createdAt: s.createdAt,
      createdBy: "usr_imported",
    });
  }
  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
