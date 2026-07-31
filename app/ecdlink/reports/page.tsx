import { EcdlinkStaffShell } from "@/components/ecdlink-staff/ecdlink-staff-shell";
import { StaffPlaceholderPage } from "@/components/ecdlink-staff/staff-placeholder-page";

export default function EcdlinkStaffReportsPage() {
  return (
    <EcdlinkStaffShell>
      <StaffPlaceholderPage title="Reports" description="Staff reports and operational summaries." />
    </EcdlinkStaffShell>
  );
}
