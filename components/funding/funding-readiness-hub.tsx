import type { AuthContext } from "@/lib/auth/session";
import { AdminFundingDashboard } from "@/components/funding/admin-funding-dashboard";
import { CentreFundingView } from "@/components/funding/centre-funding-view";
import { getCurrentCentreFundingReadiness, getFundingReports, listFundingReadinessRecords } from "@/lib/funding/api";

export async function FundingReadinessHub({ mode }: { authContext?: AuthContext; mode: "centre" | "admin" }) {
  if (mode === "admin") {
    const [records, reports] = await Promise.all([listFundingReadinessRecords(), getFundingReports()]);
    return <AdminFundingDashboard records={records} reports={reports} />;
  }
  const record = await getCurrentCentreFundingReadiness();
  if (!record) return null;
  return <CentreFundingView record={record} />;
}
