import { NextResponse } from "next/server";
import { getCustomers } from "@/lib/store";
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
  const rows = getCustomers().filter((c) => saleInRange(c.createdAt, range));
  const headers = ["id", "name", "phone", "email", "pointsBalance", "createdAt"];
  const csv = [
    headers.join(","),
    ...rows.map((c) =>
      [
        esc(c.id),
        esc(c.name),
        esc(c.phone ?? ""),
        esc(c.email ?? ""),
        esc(c.pointsBalance ?? 0),
        esc(c.createdAt),
      ].join(","),
    ),
  ].join("\n");

  const tag =
    range === "all" ? "todo" : `${dateToYmd(new Date(range.fromMs))}_${dateToYmd(new Date(range.toMs))}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes_${tag}.csv"`,
    },
  });
}
