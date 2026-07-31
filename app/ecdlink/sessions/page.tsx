import { EcdlinkStaffShell } from "@/components/ecdlink-staff/ecdlink-staff-shell";
import { StaffPlaceholderPage } from "@/components/ecdlink-staff/staff-placeholder-page";

export default function EcdlinkStaffSessionsPage() {
  return (
    <EcdlinkStaffShell>
      <StaffPlaceholderPage title="Sessions" description="Centre support sessions, visit notes and meeting records." />
    </EcdlinkStaffShell>
  );
}
