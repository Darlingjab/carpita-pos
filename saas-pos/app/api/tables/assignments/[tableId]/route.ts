import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import { removeTableAssignmentFromStore } from "@/lib/store";
import { getSessionUserOrNull } from "@/lib/auth";

/** DELETE /api/tables/assignments/:tableId — elimina una asignación de mesa */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> },
) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tableId } = await params;
  if (!tableId) return NextResponse.json({ error: "tableId required" }, { status: 400 });

  removeTableAssignmentFromStore(tableId);
  const pushed = await pushRuntimeToCloud();
  if (!pushed.ok) {
    return NextResponse.json({ error: "cloud_sync_failed", detail: pushed.error }, { status: 503 });
  }
  return NextResponse.json({ data: { ok: true } });
}
