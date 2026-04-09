"use client";

type PeriodOpt = "day" | "week" | "month" | "all";

function options(allLabel: string): { period: PeriodOpt; label: string }[] {
  return [
    { period: "day", label: "Día" },
    { period: "week", label: "Semana" },
    { period: "month", label: "Mes" },
    { period: "all", label: allLabel },
  ];
}

/**
 * Enlaces GET a una ruta de exportación con ?period= (día / semana / mes / sin filtro).
 * `extraParams` se fusiona siempre (p. ej. format=csv, source=imported).
 * Con `pickerRange`, el último botón aplica from/to del filtro (etiqueta «Rango»).
 */
export function ExportCsvPeriodLinks({
  hrefBase,
  label,
  extraParams,
  pickerRange,
}: {
  hrefBase: string;
  label: string;
  extraParams?: Record<string, string>;
  pickerRange?: { from: string; to: string } | null;
}) {
  const allLabel = pickerRange?.from && pickerRange?.to ? "Rango" : "Todo";

  function href(period: PeriodOpt): string {
    const sp = new URLSearchParams(extraParams ?? {});
    if (period !== "all") {
      sp.set("period", period);
    } else if (pickerRange?.from && pickerRange?.to) {
      sp.set("from", pickerRange.from);
      sp.set("to", pickerRange.to);
    }
    const q = sp.toString();
    return q ? `${hrefBase}?${q}` : hrefBase;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options(allLabel).map(({ period, label: lb }) => (
          <a
            key={period}
            href={href(period)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg border border-slate-200 bg-white px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-slate-700 no-underline hover:bg-slate-50"
          >
            {lb}
          </a>
        ))}
      </div>
    </div>
  );
}
