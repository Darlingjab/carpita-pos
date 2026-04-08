import { LegacySectionStub } from "@/lib/components/LegacySectionStub";

export default function AuditoriaPage() {
  return (
    <LegacySectionStub
      title="Auditoría"
      description="Registro de acciones con AuditService en el legacy (Firebase + logAudit). Aquí irá trazabilidad con Supabase y políticas RLS."
      legacyFile="pages/AuditView.jsx + services/AuditService.js"
    />
  );
}
