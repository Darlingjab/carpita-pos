import Image from "next/image";
import Link from "next/link";
import { DashboardNav } from "@/lib/components/DashboardNav";
import { DashboardUserMenu } from "@/lib/components/DashboardUserMenu";
import { getCurrentUserMock } from "@/lib/auth";
import { formatRole } from "@/lib/locale";
import { RoleGate } from "@/lib/components/RoleGate";
import { RegisterClosedNoticeModal } from "@/lib/components/RegisterClosedNoticeModal";
import { OfflineProtection } from "@/lib/components/OfflineProtection";
import { defaultDashboardPath } from "@/lib/role-access";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserMock();
  const initial = user.fullName.trim().charAt(0).toUpperCase() || "·";

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ backgroundColor: "var(--pos-bg)", color: "var(--pos-text)" }}
    >
      <header
        className="sticky top-0 z-50 flex h-12 shrink-0 items-stretch border-b bg-white px-2 sm:px-3"
        style={{ borderColor: "var(--pos-border)" }}
      >
        <Link
          href={defaultDashboardPath(user.role)}
          className="flex shrink-0 items-center pr-1 sm:pr-2"
          title={user.role === "cook" ? "Ir a cocina" : "Ir a restaurante"}
        >
          <div className="flex items-center gap-2">
            <Image
              src="/logo/carpita.svg"
              alt="Carpita"
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white p-1"
            />
          </div>
        </Link>
        <DashboardNav role={user.role} enabled={user.enabled !== false} />
        <div
          className="flex shrink-0 items-center border-l pl-1 sm:pl-2"
          style={{ borderColor: "var(--pos-border)" }}
        >
          <DashboardUserMenu fullName={user.fullName} roleLabel={formatRole(user.role)} initial={initial} />
        </div>
      </header>
      <RegisterClosedNoticeModal />
      <OfflineProtection />
      <main className="mx-auto min-h-0 w-full max-w-[1800px] flex-1 overflow-x-auto p-3 sm:p-4">
        <RoleGate role={user.role} enabled={user.enabled !== false}>
          {children}
        </RoleGate>
      </main>
    </div>
  );
}
