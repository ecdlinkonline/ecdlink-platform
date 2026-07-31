import { EcdlinkStaffShell } from "@/components/ecdlink-staff/ecdlink-staff-shell";
import { StaffPlaceholderPage } from "@/components/ecdlink-staff/staff-placeholder-page";

export default function EcdlinkStaffCalendarPage() {
  return (
    <EcdlinkStaffShell>
      <StaffPlaceholderPage title="Calendar" description="Staff schedule, centre visits, events and reminders." />
    </EcdlinkStaffShell>
  );
}
