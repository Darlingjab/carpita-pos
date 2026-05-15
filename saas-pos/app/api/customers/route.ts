import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import { addCustomer, getCustomers } from "@/lib/store";
import { getCurrentBusinessMock, getSessionUserOrNull, hasPermission } from "@/lib/auth";
import type { Customer } from "@/lib/types";

export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "reports.read") && !hasPermission(user, "sales.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ data: getCustomers() });
}

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Reusamos permiso de reports o admin en demo; ajustar luego.
  if (!hasPermission(user, "reports.read") && !hasPermission(user, "sales.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const business = getCurrentBusinessMock();
  const body = (await request.json()) as { name: string; phone?: string | null; email?: string | null };
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const customer: Customer = {
    id: `cus_${randomUUID()}`,
    businessId: business.id,
    name,
    phone: body.phone ?? null,
    email: body.email ?? null,
    pointsBalance: 0,
    createdAt: new Date().toISOString(),
  };
  addCustomer(customer);
  const pushed = await pushRuntimeToCloud();
  if (!pushed.ok) {
    return NextResponse.json(
      { error: "cloud_sync_failed", detail: pushed.error },
      { status: 503 },
    );
  }
  return NextResponse.json({ data: customer }, { status: 201 });
}

