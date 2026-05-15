import Image from "next/image";
import Link from "next/link";
import { DashboardNav } from "@/lib/components/DashboardNav";
import { DashboardUserMenu } from "@/lib/components/DashboardUserMenu";
import { getCurrentUserMock } from "@/lib/auth";
import { formatRole } from "@/lib/locale";
import { RoleGate } from "@/lib/components/RoleGate";
import { RegisterClosedNoticeModal } from "@/lib/components/RegisterClosedNoticeModal";
import { RegisterStatusChip } from "@/lib/components/RegisterStatusChip";
import { OfflineProtection } from "@/lib/components/OfflineProtection";
import { OfflineSalesSync } from "@/lib/components/OfflineSalesSync";
import { defaultDashboardPath } from "@/lib/role-access";
import { ThemeManager } from "@/lib/components/ThemeManager";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserMock();
  const initial = user.fullName.trim().charAt(0).toUpperCase() || "·";

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ backgroundColor: "var(--pos-bg)", color: "var(--pos-text)" }}
    >
      <ThemeManager />
      <header
        className="sticky top-0 z-50 flex h-12 shrink-0 items-stretch border-b bg-white px-2 sm:px-3"
        style={{
          borderColor: "var(--pos-border)",
          boxShadow: "0 1px 0 var(--pos-border), 0 2px 8px rgb(15 23 42 / 0.04)",
        }}
      >
        <Link
          href={user.role === "cook" ? "/cocina" : "/inicio"}
          className="flex shrink-0 items-center gap-2 pr-2 sm:pr-3"
          title="Ir a inicio"
        >
          <Image
            src="/logo/carpita.svg"
            alt="Carpita"
            width={28}
            height={28}
            unoptimized
            className="h-7 w-7 rounded-lg border border-slate-100 bg-white p-0.5 shadow-sm"
          />
          <span className="hidden text-[0.72rem] font-black uppercase tracking-widest text-slate-800 sm:block">
            Carpita
          </span>
        </Link>
        {/* Separador vertical */}
        <div className="my-2.5 mr-1 w-px bg-slate-100 sm:mr-2" aria-hidden />
        <DashboardNav role={user.role} enabled={user.enabled !== false} />
        <div
          className="flex shrink-0 items-center gap-2 border-l pl-2 sm:pl-3"
          style={{ borderColor: "var(--pos-border)" }}
        >
          <RegisterStatusChip />
          <DashboardUserMenu fullName={user.fullName} roleLabel={formatRole(user.role)} initial={initial} />
        </div>
      </header>
      <RegisterClosedNoticeModal />
      <OfflineSalesSync />
      <OfflineProtection />
      <main className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col overflow-x-auto p-3 sm:p-4">
        <RoleGate role={user.role} enabled={user.enabled !== false}>
          {children}
        </RoleGate>
      </main>
    </div>
  );
}
