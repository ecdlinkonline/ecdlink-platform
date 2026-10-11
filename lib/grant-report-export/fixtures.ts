import type { GrantReportExportData, SupportedGrantReportExportType } from "@/lib/grant-report-export/types";

export function buildGrantReportExportFixture(options: {
  reportType?: SupportedGrantReportExportType;
  status?: "DRAFT" | "SUBMITTED";
  quarter?: number;
  periodStart?: string;
  periodEnd?: string;
  long?: boolean;
} = {}): GrantReportExportData {
  const reportType = options.reportType ?? "QUARTERLY_CASH_FLOW";
  const status = options.status ?? "DRAFT";
  const repeated = options.long ? "Long programme narrative for pagination. ".repeat(500) : "Delivery remained on track.";
  return {
    report: {
      id: "report-fixture", versionId: "version-fixture", versionNumber: 1,
      reportStatus: status, versionStatus: status, reportType, obligationType: reportType,
      title: reportType === "QUARTERLY_CASH_FLOW" ? "Quarterly Cash Flow Report" : reportType === "QUARTERLY_EXPENDITURE" ? "Quarterly Expenditure Report" : "NLC Grant Report",
      dueAt: "2027-01-07T00:00:00.000Z",
      reportingPeriodStart: options.periodStart ?? "2026-10-01T00:00:00.000Z",
      reportingPeriodEnd: options.periodEnd ?? "2026-12-31T00:00:00.000Z",
      financialYear: "2026", quarter: options.quarter ?? 3, currency: "ZAR",
      submittedAt: status === "SUBMITTED" ? "2027-01-05T10:30:00.000Z" : null,
      submittedBy: status === "SUBMITTED" ? "Admin User" : null,
    },
    identity: {
      awardNumber: "AWD-2026-001", awardTitle: "ECD programme support", awardedAmount: "100000.00",
      centreName: "Ikhaya Early Learning Centre", centreNpoNumber: "123-456 NPO",
      projectTitle: "Quality learning programme", leadOrganisation: "Community Fund",
    },
    totals: {
      fundingReceived: "33842.58", otherIncome: "250.00", totalIncome: "34092.58",
      quarterlyExpenditure: "27106.20", cumulativeExpenditure: "27106.20", totalExpenditure: "27106.20",
      surplusDeficit: "6986.38", openingBankBalance: "68303.86", closingBankBalance: "47921.28",
    },
    narratives: {
      executiveSummary: repeated, objectives: "Improve early learning outcomes.", deliverables: "Learning materials delivered.",
      organisationalChanges: null, communityChanges: null, challenges: "Transport costs increased.",
      lessonsLearned: "Order earlier.", nextSteps: "Continue delivery.", financial: "All values retain exact cents.",
    },
    financialLines: [
      {
        id: "line-1", lineType: "EXPENDITURE", categoryCode: "NUTRITION", categoryName: "Nutrition / Groceries",
        description: "Meals", approvedBudget: "30000.00", quarterlyBudget: "28000.00", quarterlyActual: "27106.20",
        fundingSourceActual: "27106.20", otherSourceActual: "0.00", cumulativeActual: "27106.20",
        estimatedExpenditure: "27106.20", variance: "893.80", reasonForVariance: "Supplier savings", displayOrder: 0,
      },
    ],
    indicators: [{ id: "indicator-1", objective: "Improve learning", deliverable: "Materials", indicator: "Children reached", baseline: "0", target: "100", achieved: "90", status: "ON_TRACK", progressNarrative: "On track", meansOfVerification: "Attendance register" }],
    beneficiaries: [{ category: "CHILDREN_0_18", total: 90, male: 44, female: 46 }],
    racialProfile: [{ racialGroup: "AFRICAN", children: 90, youth: 0, men: 0, women: 0, olderPersons: 0, peopleWithDisabilities: 2 }],
    sustainability: [{ plan: "Train practitioners", progressToDate: "Training scheduled" }],
    certifications: [{ party: "COMPILER", name: "Nomsa Example", designation: "Principal", certificationDate: "2027-01-04T00:00:00.000Z", digitallyConfirmed: true, confirmedAt: "2027-01-04T12:00:00.000Z", confirmationText: "I confirm this report." }],
    evidence: [{ id: "document-1", documentType: "INVOICE", title: "Nutrition invoice", description: "Quarterly food purchase", originalFilename: "invoice.pdf", mimeType: "application/pdf", fileSize: 1024, checksum: "a".repeat(64), uploadedAt: "2026-11-01T10:00:00.000Z", indicator: null, financialLine: { id: "line-1", label: "Nutrition / Groceries", lineType: "EXPENDITURE" } }],
    readiness: { state: status === "SUBMITTED" ? "NEEDS_REVIEW" : null, warningAcknowledged: status === "SUBMITTED", warnings: status === "SUBMITTED" ? [{ id: "cash-position", group: "financial", title: "Recorded cash position", detail: "Review the recorded position." }] : null },
    historicalIntegrity: { usesVersionOwnedContent: true, exactLegacyReproductionClaimed: false, unavailableSnapshots: [] },
  };
}
