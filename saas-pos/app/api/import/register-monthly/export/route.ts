import { NextResponse } from "next/server";
import { getSessionUserOrNull, hasPermission } from "@/lib/auth";
import { importedSalesStats } from "@/lib/data/imported-sales-stats";
import {
  resolveExportRangeFromSearchParams,
  dateToYmd,
  monthKeyOverlapsRange,
} from "@/lib/export-period";

function esc(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

type Row = { tickets: number; revenue: number; cash: number; card: number; transfer: number };

export async function GET(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "reports.read") && !hasPermission(user, "sales.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const range = resolveExportRangeFromSearchParams(url.searchParams);
  const raw = (
    importedSalesStats as { registerMonthlyFromImport?: Record<string, Row> }
  ).registerMonthlyFromImport;
  const monthly = raw && typeof raw === "object" ? raw : {};

  const rows = Object.entries(monthly)
    .filter(([ym]) => monthKeyOverlapsRange(ym, range))
    .sort(([a], [b]) => b.localeCompare(a));

  const headers = ["month", "tickets", "revenue", "cash", "card", "transfer"];
  const csv = [
    headers.join(","),
    ...rows.map(([ym, r]) =>
      [
        esc(ym),
        esc(r.tickets),
        esc(Number(r.revenue).toFixed(2)),
        esc(Number(r.cash).toFixed(2)),
        esc(Number(r.card).toFixed(2)),
        esc(Number(r.transfer).toFixed(2)),
      ].join(","),
    ),
  ].join("\n");

  const tag =
    range === "all" ? "todo" : `${dateToYmd(new Date(range.fromMs))}_${dateToYmd(new Date(range.toMs))}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arqueos_mensual_import_${tag}.csv"`,
    },
  });
}
