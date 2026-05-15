import { AuditoriaView } from "@/lib/components/AuditoriaView";
import { SectionSubNav, SUB_NAV_GROUPS } from "@/lib/components/SectionSubNav";

export default function AuditoriaPage() {
  return (
    <>
      <SectionSubNav items={SUB_NAV_GROUPS.admin} />
      <AuditoriaView />
    </>
  );
}
