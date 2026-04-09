import { NextResponse } from "next/server";
import { getKitchenTickets } from "@/lib/store";
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
  if (!hasPermission(user, "kitchen.access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const range = resolveExportRangeFromSearchParams(url.searchParams);
  const rows = getKitchenTickets().filter((t) => saleInRange(t.createdAt, range));
  const headers = [
    "id",
    "channel",
    "tableId",
    "tableLabel",
    "counterOrderId",
    "status",
    "createdAt",
    "readyAt",
    "items",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((t) =>
      [
        esc(t.id),
        esc(t.channel),
        esc(t.tableId ?? ""),
        esc(t.tableLabel ?? ""),
        esc(t.counterOrderId ?? ""),
        esc(t.status),
        esc(t.createdAt),
        esc(t.readyAt ?? ""),
        esc((t.items ?? []).map((i) => `${i.qty}x ${i.name}`).join(" | ")),
      ].join(","),
    ),
  ].join("\n");

  const tag =
    range === "all" ? "todo" : `${dateToYmd(new Date(range.fromMs))}_${dateToYmd(new Date(range.toMs))}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cocina_tickets_${tag}.csv"`,
    },
  });
}
