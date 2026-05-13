import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import { getSessionUserOrNull, hasPermission } from "@/lib/auth";
import type { Permission } from "@/lib/types";
import { deleteUserAccount, findRowById, toAppUser, updateUserAccount } from "@/lib/user-accounts";

function rowToJson(r: NonNullable<ReturnType<typeof findRowById>>) {
  return {
    ...toAppUser(r),
    disabledPermissions: r.disabledPermissions,
  };
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "users.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await request.json()) as {
    fullName?: string;
    email?: string;
    password?: string;
    role?: string;
    enabled?: boolean;
    disabledPermissions?: Permission[];
  };

  const patch: Parameters<typeof updateUserAccount>[1] = {};
  if (body.fullName !== undefined) patch.fullName = body.fullName;
  if (body.email !== undefined) patch.email = body.email;
  if (body.password !== undefined && body.password.length > 0) {
    if (body.password.length < 4) {
      return NextResponse.json({ error: "password_short" }, { status: 400 });
    }
    patch.password = body.password;
  }
  if (body.role !== undefined) {
    if (!["admin", "cashier", "supervisor", "waiter", "cook"].includes(body.role)) {
      return NextResponse.json({ error: "invalid_role" }, { status: 400 });
    }
    patch.role = body.role as "admin" | "cashier" | "supervisor" | "waiter" | "cook";
  }
  if (body.enabled !== undefined) patch.enabled = body.enabled;
  if (body.disabledPermissions !== undefined) {
    patch.disabledPermissions = body.disabledPermissions;
  }

  const updated = updateUserAccount(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "not_found_or_invalid" }, { status: 400 });
  }

  const pushed = await pushRuntimeToCloud();
  if (!pushed.ok) {
    return NextResponse.json(
      { error: "cloud_sync_failed", detail: pushed.error },
      { status: 503 },
    );
  }
  return NextResponse.json({ data: rowToJson(updated) });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "users.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (id === user.id) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  }

  const ok = deleteUserAccount(id);
  if (!ok) {
    return NextResponse.json({ error: "not_found_or_last_admin" }, { status: 400 });
  }

  const pushed = await pushRuntimeToCloud();
  if (!pushed.ok) {
    return NextResponse.json(
      { error: "cloud_sync_failed", detail: pushed.error },
      { status: 503 },
    );
  }
  return NextResponse.json({ data: { ok: true } });
}
