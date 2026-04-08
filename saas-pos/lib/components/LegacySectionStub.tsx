import Link from "next/link";

type Props = {
  title: string;
  description: string;
  legacyFile?: string;
  children?: React.ReactNode;
};

/** Pantalla equivalente al legacy; contenido completo se conecta después (Supabase, etc.). */
export function LegacySectionStub({ title, description, legacyFile, children }: Props) {
  return (
    <div className="animate-fade-in rounded-xl border border-slate-200 bg-[#f8fafc] p-6 shadow-sm">
      <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
      {legacyFile && (
        <p className="mt-2 font-mono text-xs text-slate-400">
          Referencia histórica (módulo equivalente): <code>{legacyFile}</code>
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <Link href="/mesas" className="text-sm font-bold text-[var(--primary)] underline">
          ← Volver al plano
        </Link>
      </div>
    </div>
  );
}
