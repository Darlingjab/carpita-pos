import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import { addCustomerPointsMovement, findCustomer } from "@/lib/store";
import { getCurrentBusinessMock, getSessionUserOrNull, hasPermission } from "@/lib/auth";

const TIERS = [50, 100, 150] as const;

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "sales.create") && !hasPermission(user, "reports.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const business = getCurrentBusinessMock();
  const body = (await request.json()) as { customerId: string; tier: number };
  const tier = Number(body.tier);
  if (!TIERS.includes(tier as (typeof TIERS)[number])) {
    return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
  }

  const c = findCustomer(body.customerId);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((c.pointsBalance ?? 0) < tier) {
    return NextResponse.json({ error: "insufficient_points" }, { status: 400 });
  }

  addCustomerPointsMovement({
    id: `pt_redeem_${randomUUID()}`,
    businessId: business.id,
    customerId: c.id,
    type: "redeem",
    points: -tier,
    ref: `reward:${tier}`,
    createdAt: new Date().toISOString(),
  });

  const pushed = await pushRuntimeToCloud();
  if (!pushed.ok) {
    return NextResponse.json(
      { error: "cloud_sync_failed", detail: pushed.error },
      { status: 503 },
    );
  }
  return NextResponse.json({ data: { ok: true, customerId: c.id, tier } });
}

