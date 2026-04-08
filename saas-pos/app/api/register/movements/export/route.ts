import { NextResponse } from "next/server";
import { getRegisterMovements } from "@/lib/store";
import { getSessionUserOrNull, hasPermission } from "@/lib/auth";

function esc(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "reports.read") && !hasPermission(user, "sales.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = getRegisterMovements();
  const headers = ["id", "type", "amount", "note", "createdAt", "createdBy"];
  const csv = [
    headers.join(","),
    ...rows.map((m) =>
      [
        esc(m.id),
        esc(m.type),
        esc(Number(m.amount ?? 0).toFixed(2)),
        esc(m.note ?? ""),
        esc(m.createdAt),
        esc(m.createdBy),
      ].join(","),
    ),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="movimientos_caja.csv"`,
    },
  });
}
