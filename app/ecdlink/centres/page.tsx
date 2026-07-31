import { EcdlinkStaffShell } from "@/components/ecdlink-staff/ecdlink-staff-shell";
import { StaffPlaceholderPage } from "@/components/ecdlink-staff/staff-placeholder-page";

export default function EcdlinkStaffCentresPage() {
  return (
    <EcdlinkStaffShell>
      <StaffPlaceholderPage title="My Centres" description="Assigned centre list and centre support workspace." />
    </EcdlinkStaffShell>
  );
}
