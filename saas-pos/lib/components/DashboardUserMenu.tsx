"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { es } from "@/lib/locale";

type Props = {
  fullName: string;
  roleLabel: string;
  initial: string;
};

export function DashboardUserMenu({ fullName, roleLabel, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function openPasswordModal() {
    setOpen(false);
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setPwdOpen(true);
  }

  async function submitPasswordChange() {
    if (newPwd.length < 4) {
      window.alert("La nueva contraseña debe tener al menos 4 caracteres.");
      return;
    }
    if (newPwd !== confirmPwd) {
      window.alert(es.nav.passwordMismatch);
      return;
    }
    setPwdBusy(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.error === "invalid_current") {
          window.alert("La contraseña actual no es correcta.");
        } else {
          window.alert(es.nav.passwordChangeError);
        }
        return;
      }
      setPwdOpen(false);
    } finally {
      setPwdBusy(false);
    }
  }

  async function logout() {
    setOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* seguimos con redirección */
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className="flex items-center gap-0.5 rounded-md py-0.5 pl-0.5 pr-0.5 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--pos-primary)] focus-visible:ring-offset-1 sm:pr-1"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${es.nav.profileMenuAria}: ${fullName}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.62rem] font-bold text-white"
          style={{ backgroundColor: "var(--pos-primary)" }}
        >
          {initial}
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-slate-400 sm:h-3.5 sm:w-3.5 ${open ? "rotate-180" : ""} transition-transform`}
          aria-hidden
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-[200] min-w-[200px] rounded-lg border border-slate-200 bg-white py-0.5 shadow-xl"
          style={{ borderColor: "var(--pos-border)" }}
        >
          <div className="border-b border-slate-100 px-2.5 py-2">
            <p className="max-w-[220px] truncate text-xs font-bold text-slate-900">{fullName}</p>
            <p className="truncate text-[0.65rem] text-slate-500">{roleLabel}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
            onClick={() => openPasswordModal()}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            {es.nav.changePassword}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
            onClick={() => void logout()}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            {es.nav.logout}
          </button>
        </div>
      )}

      {pwdOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwd-dialog-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h2 id="pwd-dialog-title" className="text-sm font-bold text-slate-900">
              {es.nav.changePasswordTitle}
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                  {es.nav.currentPassword}
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="input-base mt-1 w-full text-sm"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                  {es.nav.newPassword}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="input-base mt-1 w-full text-sm"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                  {es.nav.confirmNewPassword}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="input-base mt-1 w-full text-sm"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
                onClick={() => setPwdOpen(false)}
                disabled={pwdBusy}
              >
                {es.nav.cancel}
              </button>
              <button
                type="button"
                className="btn-pos-primary rounded-lg px-4 py-2 text-xs font-extrabold uppercase"
                onClick={() => void submitPasswordChange()}
                disabled={pwdBusy}
              >
                {es.nav.savePassword}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
