import type { AppUser, Sale } from "@/lib/types";

/** Admin y supervisor ven todas las ventas; cajero solo las que registró o donde figura como mesero. */
export function salesVisibleToRole(all: Sale[], user: AppUser): Sale[] {
  if (user.role === "admin" || user.role === "supervisor") {
    return all;
  }
  return all.filter(
    (s) => s.createdBy === user.id || (s.serverId != null && s.serverId === user.id),
  );
}
