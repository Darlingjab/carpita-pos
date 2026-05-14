"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Printer, Users } from "lucide-react";
import { EquipoTeamPanel } from "@/lib/components/EquipoTeamPanel";
import {
  defaultPrinterSettings,
  PRINTER_SETTINGS_KEY,
  type PrinterTicketSettings,
} from "@/lib/printer-settings";

type ConfigTab = "ajustes" | "equipo";

const TABS: { id: ConfigTab; label: string; icon: LucideIcon }[] = [
  { id: "ajustes", label: "Ajustes de impresora", icon: Printer },
  { id: "equipo", label: "Equipo", icon: Users },
];


function parseTab(v: string | null): ConfigTab {
  if (v === "equipo" || v === "ajustes") return v;
  return "equipo"; // default: equipo es la sección más usada desde el nav
}

export function ConfigPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const [printer, setPrinter] = useState<PrinterTicketSettings>(defaultPrinterSettings);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    try {
      const r = localStorage.getItem(PRINTER_SETTINGS_KEY);
      if (r) setPrinter({ ...defaultPrinterSettings, ...JSON.parse(r) });
    } catch {
      /* ignore */
    }
  }, []);

  function setTab(next: ConfigTab) {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("tab", next);
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw && raw !== "ajustes" && raw !== "equipo") {
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
          {tab === "ajustes" && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-base font-black text-slate-900">Ajustes de impresora</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Define cómo se verá la comanda al enviar a cocina: encabezado, ancho térmico, texto y si se abre el
                  cuadro de impresión solo.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Nombre en ticket (encabezado)
                    </label>
                    <input
                      className="input-base mt-1.5 w-full text-sm"
                      placeholder="Ej. Carpita Restaurante"
                      value={printer.storeName}
                      onChange={(e) => setPrinter({ ...printer, storeName: e.target.value })}
                    />
                    <p className="mt-1 text-[0.7rem] text-slate-500">Aparece arriba de la comanda, centrado.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Ancho de papel
                    </label>
                    <select
                      className="input-base mt-1.5 w-full text-sm"
                      value={printer.paperWidth}
                      onChange={(e) =>
                        setPrinter({
                          ...printer,
                          paperWidth: e.target.value as PrinterTicketSettings["paperWidth"],
                        })
                      }
                    >
                      <option value="58mm">58 mm (estrecho)</option>
                      <option value="80mm">80 mm (estándar)</option>
                    </select>
                    <p className="mt-1 text-[0.7rem] text-slate-500">Limita el ancho de la vista previa al imprimir.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Tamaño del texto
                    </label>
                    <select
                      className="input-base mt-1.5 w-full text-sm"
                      value={printer.fontScale}
                      onChange={(e) =>
                        setPrinter({
                          ...printer,
                          fontScale: e.target.value as PrinterTicketSettings["fontScale"],
                        })
                      }
                    >
                      <option value="compact">Compacto</option>
                      <option value="normal">Normal</option>
                      <option value="large">Grande</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Pie de ticket (opcional)
                    </label>
                    <textarea
                      className="input-base mt-1.5 min-h-[72px] w-full resize-y text-sm"
                      placeholder="Ej. Gracias por su visita · Tel. 02-xxx-xxxx"
                      value={printer.footerLine}
                      onChange={(e) => setPrinter({ ...printer, footerLine: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="mt-6 space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">Comportamiento</p>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={printer.showDateTime}
                      onChange={(e) => setPrinter({ ...printer, showDateTime: e.target.checked })}
                    />
                    <span>
                      <span className="font-semibold text-slate-800">Mostrar fecha y hora</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Incluye la marca de tiempo en la comanda (útil para cocina).
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={printer.autoPrint}
                      onChange={(e) => setPrinter({ ...printer, autoPrint: e.target.checked })}
                    />
                    <span>
                      <span className="font-semibold text-slate-800">Abrir diálogo de impresión al enviar</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Si lo desactivas, se abre la vista previa y puedes imprimir con Ctrl/Cmd+P o el menú del
                        navegador.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn-pos-primary rounded-lg px-6 py-2.5 text-sm font-extrabold uppercase"
                    onClick={savePrinter}
                  >
                    Guardar ajustes
                  </button>
                  {savedFlash && (
                    <span className="text-sm font-semibold text-emerald-600" role="status">
                      Guardado en este dispositivo
                    </span>
                  )}
                </div>
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
