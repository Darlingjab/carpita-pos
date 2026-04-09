import { NextResponse } from "next/server";
import { getRegisterMovements } from "@/lib/store";
import { getSessionUserOrNull, hasPermission } from "@/lib/auth";
import { resolveExportRangeFromSearchParams, dateToYmd, saleInRange } from "@/lib/export-period";

function esc(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function GET(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "reports.read") && !hasPermission(user, "sales.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const range = resolveExportRangeFromSearchParams(url.searchParams);
  const rows = getRegisterMovements().filter((m) => saleInRange(m.createdAt, range));
  const headers = ["id", "type", "amount", "cashDelta", "note", "voidsMovementId", "createdAt", "createdBy"];
  const { registerMovementCashDelta } = await import("@/lib/register-balance");
  const csv = [
    headers.join(","),
    ...rows.map((m) =>
      [
        esc(m.id),
        esc(m.type),
        esc(Number(m.amount ?? 0).toFixed(2)),
        esc(Number(registerMovementCashDelta(m)).toFixed(2)),
        esc(m.note ?? ""),
        esc(m.voidsMovementId ?? ""),
        esc(m.createdAt),
        esc(m.createdBy),
      ].join(","),
    ),
  ].join("\n");

  const tag =
    range === "all" ? "todo" : `${dateToYmd(new Date(range.fromMs))}_${dateToYmd(new Date(range.toMs))}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="movimientos_caja_pos_${tag}.csv"`,
    },
  });
}
