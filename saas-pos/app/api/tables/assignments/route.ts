import { NextResponse } from "next/server";
import { pullRuntimeFromCloud, pushRuntimeToCloud } from "@/lib/cloud-sync";
import {
  getTableAssignments,
  upsertTableAssignmentInStore,
} from "@/lib/store";
import { getSessionUserOrNull } from "@/lib/auth";
import type { TableAssignment } from "@/lib/table-assignments";

/** GET /api/tables/assignments — devuelve todas las asignaciones de mesa activas */
export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await pullRuntimeFromCloud();
  return NextResponse.json({ data: getTableAssignments() });
}

/** POST /api/tables/assignments — crea o actualiza una asignación de mesa */
export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    tableId?: string;
    assignment?: TableAssignment;
  };

  if (!body.tableId || !body.assignment) {
    return NextResponse.json({ error: "tableId and assignment required" }, { status: 400 });
  }

  upsertTableAssignmentInStore(body.tableId, body.assignment);
  const pushed = await pushRuntimeToCloud();
  if (!pushed.ok) {
    return NextResponse.json({ error: "cloud_sync_failed", detail: pushed.error }, { status: 503 });
  }
  return NextResponse.json({ data: getTableAssignments() }, { status: 201 });
}
