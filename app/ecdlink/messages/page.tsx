import { EcdlinkStaffShell } from "@/components/ecdlink-staff/ecdlink-staff-shell";
import { StaffPlaceholderPage } from "@/components/ecdlink-staff/staff-placeholder-page";

export default function EcdlinkStaffMessagesPage() {
  return (
    <EcdlinkStaffShell>
      <StaffPlaceholderPage title="Messages" description="Secure staff, centre and ECDLink communication." />
    </EcdlinkStaffShell>
  );
}
