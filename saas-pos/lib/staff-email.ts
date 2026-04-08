import { demoBusiness } from "@/lib/mock-data";

/** Primer nombre en minúsculas, sin acentos, + @ + dominio del negocio (ej. lester@carpita). */
export function suggestStaffEmailLocalPart(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "usuario";
  const ascii = first
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return ascii || "usuario";
}

export function suggestStaffEmail(fullName: string): string {
  const domain = (demoBusiness.staffEmailDomain ?? "local").toLowerCase().replace(/[^a-z0-9.-]/g, "") || "local";
  const local = suggestStaffEmailLocalPart(fullName);
  return `${local}@${domain}`;
}

export function uniqueStaffEmail(fullName: string, exists: (email: string) => boolean): string {
  const base = suggestStaffEmail(fullName);
  if (!exists(base)) return base;
  const domain = base.split("@")[1] ?? "local";
  const localBase = base.split("@")[0] ?? "usuario";
  let n = 2;
  while (exists(`${localBase}${n}@${domain}`)) n += 1;
  return `${localBase}${n}@${domain}`;
}
