import { getAuthContext } from "@/lib/auth/session";
import { hasDatabaseConfig } from "@/lib/db/env";
import { annualMembershipFee } from "@/lib/membership/format";
import { membershipRecords } from "@/lib/membership/data";
import type { MembershipFilters, MembershipRecord, MembershipReport } from "@/lib/membership/types";
import { getCentreIdForClerkUser, getMembershipRecordByCentreId } from "@/lib/repositories/memberships";
import { getMembershipReportsFromDatabase, listMembershipsFromDatabase } from "@/lib/services/memberships";

function filterFallbackMemberships(filters: MembershipFilters = {}) {
  const query = filters.query?.trim().toLowerCase() ?? "";
  return membershipRecords.filter((membership) => {
    const searchable = [
      membership.centreName,
      membership.region,
      membership.area,
      membership.contactPerson,
      membership.emailAddress,
      membership.npoNumber,
      membership.invoiceNumber,
      membership.status,
      membership.paymentStatus
    ].join(" ").toLowerCase();

    return (
      (!query || searchable.includes(query)) &&
      (!filters.status || filters.status === "All" || membership.status === filters.status) &&
      (!filters.paymentStatus || filters.paymentStatus === "All" || membership.paymentStatus === filters.paymentStatus) &&
      (!filters.region || filters.region === "All" || membership.region === filters.region) &&
      (!filters.year || filters.year === "All" || membership.membershipYear === filters.year)
    );
  });
}

function fallbackReport(records: MembershipRecord[]): MembershipReport {
  const activeCount = records.filter((membership) => membership.status === "Active").length;
  const pendingCount = records.filter((membership) => membership.status === "Pending").length;
  const expiredCount = records.filter((membership) => membership.status === "Expired").length;
  const overdueCount = records.filter((membership) => membership.status === "Overdue").length;
  const collectedRevenue = records.reduce((sum, membership) => sum + membership.amountPaid, 0);
  const expectedAnnualRevenue = records.reduce((sum, membership) => sum + membership.annualFee, 0);
  const regions = Array.from(new Set(records.map((membership) => membership.region)));
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 45);

  return {
    activeCount,
    pendingCount,
    expiredCount,
    overdueCount,
    annualFee: annualMembershipFee,
    expectedAnnualRevenue,
    collectedRevenue,
    outstandingRevenue: expectedAnnualRevenue - collectedRevenue,
    statusBreakdown: [
      { label: "Active", value: activeCount },
      { label: "Pending", value: pendingCount },
      { label: "Overdue", value: overdueCount },
      { label: "Expired", value: expiredCount }
    ],
    revenueByRegion: regions.map((region) => ({
      label: region,
      value: records.filter((membership) => membership.region === region).reduce((sum, membership) => sum + membership.amountPaid, 0)
    })),
    renewalsDue: records.filter((membership) => membership.status === "Overdue" || membership.status === "Expired" || membership.status === "Pending"),
    overdueMemberships: records.filter((membership) => membership.status === "Overdue"),
    expiringSoon: records.filter((membership) => {
      const expiry = new Date(membership.expiryDate);
      return expiry >= now && expiry <= soon;
    })
  };
}

export async function listMemberships(filters: MembershipFilters = {}) {
  if (hasDatabaseConfig()) return listMembershipsFromDatabase(filters);
  return filterFallbackMemberships(filters);
}

export async function getMembershipByCentreId(centreId: string) {
  if (hasDatabaseConfig()) return getMembershipRecordByCentreId(centreId);
  return membershipRecords.find((membership) => membership.centreId === centreId) ?? null;
}

export async function getCurrentCentreMembership() {
  if (hasDatabaseConfig()) {
    const authContext = await getAuthContext();
    if (!authContext) return null;
    if (authContext.role === "super_admin") {
      return getMembershipRecordByCentreId("little-stars-ecd");
    }
    const centreId = await getCentreIdForClerkUser(authContext.userId);
    return centreId ? getMembershipRecordByCentreId(centreId) : null;
  }

  return getMembershipByCentreId("little-stars-ecd");
}

export async function generateMembershipInvoice(membership: MembershipRecord) {
  return {
    invoiceNumber: membership.invoiceNumber,
    amount: membership.annualFee,
    status: "Generated" as const,
    pdfPlaceholder: "Membership invoice PDF placeholder"
  };
}

export async function getMembershipReports(): Promise<MembershipReport> {
  if (hasDatabaseConfig()) return getMembershipReportsFromDatabase();
  return fallbackReport(membershipRecords);
}
