import { EcdlinkStaffShell } from "@/components/ecdlink-staff/ecdlink-staff-shell";
import { StaffPlaceholderPage } from "@/components/ecdlink-staff/staff-placeholder-page";

export default function EcdlinkStaffDocumentsPage() {
  return (
    <EcdlinkStaffShell>
      <StaffPlaceholderPage title="Documents" description="Field documents, staff uploads and centre evidence." />
    </EcdlinkStaffShell>
  );
}
