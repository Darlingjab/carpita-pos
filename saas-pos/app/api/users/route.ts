import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import { getCurrentBusinessMock, getSessionUserOrNull, hasPermission } from "@/lib/auth";
import type { Permission } from "@/lib/types";
import {
  createUserAccount,
  getAllUserRows,
  suggestNewUserEmail,
  toAppUser,
} from "@/lib/user-accounts";

function rowToJson(r: ReturnType<typeof getAllUserRows>[number]) {
  return {
    ...toAppUser(r),
    disabledPermissions: r.disabledPermissions,
  };
}

export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = hasPermission(user, "users.manage");
  const canViewTeam = canManage || user.role === "supervisor" || user.role === "admin";
  if (!canViewTeam) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = getAllUserRows();
  const data = rows.map(rowToJson);
  return NextResponse.json({
    data,
    meta: {
      canManageUsers: canManage,
      staffEmailDomain: getCurrentBusinessMock().staffEmailDomain ?? "local",
    },
  });
}

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "users.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    fullName?: string;
    email?: string;
    password?: string;
    role?: string;
    enabled?: boolean;
    disabledPermissions?: Permission[];
  };

  const fullName = (body.fullName ?? "").trim();
  const password = body.password ?? "";
  const role = body.role as "admin" | "cashier" | "supervisor" | "waiter" | "cook" | undefined;
  if (!fullName || !role || !["admin", "cashier", "supervisor", "waiter", "cook"].includes(role)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "password_short" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase() || suggestNewUserEmail(fullName);
  const created = createUserAccount({
    fullName,
    email,
    password,
    role,
    enabled: body.enabled !== false,
    disabledPermissions: Array.isArray(body.disabledPermissions) ? body.disabledPermissions : [],
  });
  if (!created) {
    return NextResponse.json({ error: "email_taken_or_invalid" }, { status: 400 });
  }

  const pushed = await pushRuntimeToCloud();
  if (!pushed.ok) {
    return NextResponse.json(
      { error: "cloud_sync_failed", detail: pushed.error },
      { status: 503 },
    );
  }
  return NextResponse.json({ data: rowToJson(created) }, { status: 201 });
}
