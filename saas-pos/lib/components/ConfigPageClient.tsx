"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Building2, Printer, Users } from "lucide-react";
import { EquipoTeamPanel } from "@/lib/components/EquipoTeamPanel";
import {
  defaultPrinterSettings,
  PRINTER_SETTINGS_KEY,
  type PrinterTicketSettings,
} from "@/lib/printer-settings";

const RESTAURANT_PROFILE_KEY = "pos_restaurant_profile_v1";
type RestaurantProfile = { name: string; tagline: string; logoUrl: string; phone: string; address: string };
const defaultProfile: RestaurantProfile = { name: "", tagline: "", logoUrl: "", phone: "", address: "" };

type ConfigTab = "ajustes" | "equipo" | "restaurante";

const TABS: { id: ConfigTab; label: string; icon: LucideIcon }[] = [
  { id: "restaurante", label: "Restaurante", icon: Building2 },
  { id: "ajustes", label: "Impresora", icon: Printer },
  { id: "equipo", label: "Equipo", icon: Users },
];

function parseTab(v: string | null): ConfigTab {
  if (v === "equipo" || v === "ajustes" || v === "restaurante") return v;
  return "equipo"; // default: equipo es la sección más usada desde el nav
}

export function ConfigPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const [printer, setPrinter] = useState<PrinterTicketSettings>(defaultPrinterSettings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [profile, setProfile] = useState<RestaurantProfile>(defaultProfile);
  const [profileFlash, setProfileFlash] = useState(false);

  useEffect(() => {
    try {
      const r = localStorage.getItem(PRINTER_SETTINGS_KEY);
      if (r) setPrinter({ ...defaultPrinterSettings, ...JSON.parse(r) });
    } catch {
      /* ignore */
    }
    try {
      const p = localStorage.getItem(RESTAURANT_PROFILE_KEY);
      if (p) setProfile({ ...defaultProfile, ...JSON.parse(p) });
    } catch {
      /* ignore */
    }
  }, []);

  const saveProfile = () => {
    localStorage.setItem(RESTAURANT_PROFILE_KEY, JSON.stringify(profile));
    setProfileFlash(true);
    window.setTimeout(() => setProfileFlash(false), 2200);
  };

  function setTab(next: ConfigTab) {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("tab", next);
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw && raw !== "ajustes" && raw !== "equipo" && raw !== "restaurante") {
      const qs = new URLSearchParams(searchParams.toString());
      qs.set("tab", "equipo");
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  const savePrinter = () => {
    localStorage.setItem(PRINTER_SETTINGS_KEY, JSON.stringify(printer));
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Equipo y configuración</h1>
        <p className="mt-1 text-sm text-slate-500">Gestioná los usuarios del restaurante y ajustes del sistema.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#f8fafc] shadow-sm">
        <div className="flex shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-1 sm:px-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex min-w-max items-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors sm:px-4 sm:py-3 sm:text-sm ${
                  active
                    ? "border-b-[3px] text-[var(--pos-primary)]"
                    : "border-b-[3px] border-transparent text-slate-500"
                }`}
                style={active ? { borderBottomColor: "var(--pos-primary)" } : undefined}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-[320px] p-4 sm:p-6">
          {tab === "restaurante" && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-base font-black text-slate-900">Perfil del restaurante</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Nombre, logo y datos de contacto que aparecen en el sistema.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Nombre del restaurante</label>
                    <input
                      className="input-base mt-1.5 w-full text-sm"
                      placeholder="Ej. Carpita Restaurante"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Slogan / descripción corta</label>
                    <input
                      className="input-base mt-1.5 w-full text-sm"
                      placeholder="Ej. El mejor sabor de la ciudad"
                      value={profile.tagline}
                      onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Teléfono</label>
                    <input
                      className="input-base mt-1.5 w-full text-sm"
                      placeholder="Ej. +593 99 999 9999"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Dirección</label>
                    <input
                      className="input-base mt-1.5 w-full text-sm"
                      placeholder="Ej. Av. Principal 123"
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">URL del logo (imagen)</label>
                    <input
                      className="input-base mt-1.5 w-full text-sm"
                      placeholder="https://…/logo.png"
                      value={profile.logoUrl}
                      onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })}
                    />
                    {profile.logoUrl && (
                      <div className="mt-3 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={profile.logoUrl} alt="Logo" className="h-16 w-16 rounded-lg border border-slate-200 object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <p className="text-xs text-slate-500">Vista previa del logo</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    className="btn-pos-primary rounded-lg px-5 py-2.5 text-sm font-extrabold uppercase text-white"
                    onClick={saveProfile}
                  >
                    Guardar perfil
                  </button>
                  {profileFlash && (
                    <span className="text-sm font-semibold text-emerald-700">✓ Guardado</span>
                  )}
                </div>
              </div>
            </div>
          )}
          {tab === "ajustes" && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-base font-black text-slate-900">Impresora y tickets</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Configurá el logo, el encabezado, el papel y cuándo se imprime automáticamente.
                  Los cambios se guardan en este dispositivo.
                </p>
              </div>

              {/* ── Sección 1: Identidad del ticket ── */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Identidad del ticket
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  {/* Logo URL + vista previa */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      URL del logo
                    </label>
                    <div className="mt-1.5 flex items-center gap-3">
                      <input
                        className="input-base flex-1 text-sm"
                        placeholder="https://mi-restaurante.com/logo.png"
                        value={printer.logoUrl}
                        onChange={(e) => setPrinter({ ...printer, logoUrl: e.target.value })}
                      />
                      {printer.logoUrl.trim() && (
                        <img
                          src={printer.logoUrl.trim()}
                          alt="Vista previa"
                          className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-contain p-0.5"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                    </div>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Aparece en el encabezado de comandas y recibos. Dejá vacío para omitir.
                    </p>
                  </div>

                  {/* Nombre en ticket */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Nombre del restaurante en ticket
                    </label>
                    <input
                      className="input-base mt-1.5 w-full text-sm"
                      placeholder="Ej. Carpita Restaurante"
                      value={printer.storeName}
                      onChange={(e) => setPrinter({ ...printer, storeName: e.target.value })}
                    />
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Se muestra centrado en la parte superior del ticket.
                    </p>
                  </div>

                  {/* Pie de ticket */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Mensaje de despedida (pie del recibo)
                    </label>
                    <textarea
                      className="input-base mt-1.5 min-h-[68px] w-full resize-y text-sm"
                      placeholder="Ej. ¡Gracias por visitarnos! · Tel. 02-xxx-xxxx"
                      value={printer.footerLine}
                      onChange={(e) => setPrinter({ ...printer, footerLine: e.target.value })}
                      rows={2}
                    />
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Aparece al final del recibo del cliente. Si lo dejás vacío se muestra «¡Gracias por su visita!»
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Sección 2: Papel y texto ── */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Papel y texto
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Ancho de papel térmico
                    </label>
                    <select
                      className="input-base mt-1.5 w-full text-sm"
                      value={printer.paperWidth}
                      onChange={(e) =>
                        setPrinter({ ...printer, paperWidth: e.target.value as PrinterTicketSettings["paperWidth"] })
                      }
                    >
                      <option value="58mm">58 mm (rollo estrecho)</option>
                      <option value="80mm">80 mm (estándar POS)</option>
                    </select>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      Ajusta el ancho de impresión para que el ticket ocupe todo el papel.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Tamaño de letra
                    </label>
                    <select
                      className="input-base mt-1.5 w-full text-sm"
                      value={printer.fontScale}
                      onChange={(e) =>
                        setPrinter({ ...printer, fontScale: e.target.value as PrinterTicketSettings["fontScale"] })
                      }
                    >
                      <option value="compact">Compacto — más ítems por hoja</option>
                      <option value="normal">Normal</option>
                      <option value="large">Grande — más legible</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Sección 3: Comportamiento de impresión ── */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Comportamiento de impresión
                </p>
                <div className="space-y-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-emerald-600"
                      checked={printer.showDateTime}
                      onChange={(e) => setPrinter({ ...printer, showDateTime: e.target.checked })}
                    />
                    <span>
                      <span className="font-semibold text-slate-800">Mostrar fecha y hora en el ticket</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Imprime la hora exacta en comandas y recibos. Útil para seguimiento en cocina.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-emerald-600"
                      checked={printer.autoPrint}
                      onChange={(e) => setPrinter({ ...printer, autoPrint: e.target.checked })}
                    />
                    <span>
                      <span className="font-semibold text-slate-800">Abrir diálogo de impresión automáticamente</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Si está activo, el cuadro de impresión del sistema se abre solo. Si lo desactivás, podés
                        revisar la vista previa antes de imprimir con Ctrl/Cmd+P.
                      </span>
                    </span>
                  </label>

                  <hr className="border-slate-100" />

                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">¿Cuándo imprimir automáticamente?</p>
                    <div className="space-y-3">
                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-emerald-600"
                          checked={printer.printKitchenAuto}
                          onChange={(e) => setPrinter({ ...printer, printKitchenAuto: e.target.checked })}
                        />
                        <span>
                          <span className="font-semibold text-slate-800">🍳 Comanda de cocina al enviar pedido</span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            Abre la comanda automáticamente cada vez que el mesero toca «Enviar a cocina».
                            Desactivalo si la cocina usa el KDS en pantalla.
                          </span>
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-emerald-600"
                          checked={printer.printReceiptAuto}
                          onChange={(e) => setPrinter({ ...printer, printReceiptAuto: e.target.checked })}
                        />
                        <span>
                          <span className="font-semibold text-slate-800">🧾 Recibo del cliente al cobrar</span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            Abre el recibo automáticamente al confirmar el pago.
                            Desactivalo si el cliente prefiere recibo digital o no lo necesita.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-pos-primary rounded-lg px-6 py-2.5 text-sm font-extrabold uppercase"
                  onClick={savePrinter}
                >
                  Guardar ajustes de impresora
                </button>
                {savedFlash && (
                  <span className="text-sm font-semibold text-emerald-600" role="status">
                    ✓ Guardado en este dispositivo
                  </span>
                )}
              </div>
            </div>
          )}

          {tab === "equipo" && (
            <div className="animate-fade-in space-y-4">
              <EquipoTeamPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
