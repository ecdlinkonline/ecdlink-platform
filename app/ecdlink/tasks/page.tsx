import { EcdlinkStaffShell } from "@/components/ecdlink-staff/ecdlink-staff-shell";
import { StaffPlaceholderPage } from "@/components/ecdlink-staff/staff-placeholder-page";

export default function EcdlinkStaffTasksPage() {
  return (
    <EcdlinkStaffShell>
      <StaffPlaceholderPage title="Tasks & Follow-ups" description="Internal tasks, follow-ups and centre action tracking." />
    </EcdlinkStaffShell>
  );
}
