import type { AuthContext } from "@/lib/auth/session";
import { AdminComplianceDashboard } from "@/components/compliance/admin-compliance-dashboard";
import { CentreComplianceView } from "@/components/compliance/centre-compliance-view";
import { getComplianceReports, getCurrentCentreCompliance, listComplianceRecords } from "@/lib/compliance/api";

export async function ComplianceHub({ mode }: { authContext?: AuthContext; mode: "centre" | "admin" }) {
  if (mode === "admin") {
    const [records, reports] = await Promise.all([listComplianceRecords(), getComplianceReports()]);
    return <AdminComplianceDashboard records={records} reports={reports} />;
  }
  const record = await getCurrentCentreCompliance();
  if (!record) return null;
  return <CentreComplianceView record={record} />;
}
