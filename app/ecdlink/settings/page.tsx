import { EcdlinkStaffShell } from "@/components/ecdlink-staff/ecdlink-staff-shell";
import { StaffPlaceholderPage } from "@/components/ecdlink-staff/staff-placeholder-page";

export default function EcdlinkStaffSettingsPage() {
  return (
    <EcdlinkStaffShell>
      <StaffPlaceholderPage title="Settings" description="Staff profile and workspace preferences." />
    </EcdlinkStaffShell>
  );
}
