import { LegacySectionStub } from "@/lib/components/LegacySectionStub";

export default function ControlPage() {
  return (
    <LegacySectionStub
      title="Control / Master"
      description="Acceso tipo MasterAccess del proyecto anterior (PIN, diagnósticos). No expuesto en la barra principal por seguridad; ruta directa /control."
      legacyFile="pages/MasterAccess.jsx"
    />
  );
}
