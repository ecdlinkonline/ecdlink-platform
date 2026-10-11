import type { GrantObligationType, GrantReportVersionStatus } from "@prisma/client";

export type SupportedGrantReportExportType = "INTERIM" | "FINAL" | "QUARTERLY_EXPENDITURE" | "QUARTERLY_CASH_FLOW";

export type GrantReportExportFinancialLine = {
  id: string; lineType: string; categoryCode: string | null; categoryName: string; description: string | null;
  approvedBudget: string | null; quarterlyBudget: string | null; quarterlyActual: string | null;
  fundingSourceActual: string | null; otherSourceActual: string | null; cumulativeActual: string | null;
  estimatedExpenditure: string | null; variance: string | null; reasonForVariance: string | null; displayOrder: number;
};
export type GrantReportExportEvidence = {
  id: string; documentType: string; title: string; description: string | null; originalFilename: string;
  mimeType: string; fileSize: number; checksum: string | null; uploadedAt: string;
  indicator: { id: string; label: string } | null;
  financialLine: { id: string; label: string; lineType: string } | null;
};

export type GrantReportExportData = {
  report: {
    id: string; versionId: string; versionNumber: number; reportStatus: string;
    versionStatus: GrantReportVersionStatus; reportType: SupportedGrantReportExportType;
    obligationType: GrantObligationType; title: string; dueAt: string;
    reportingPeriodStart: string | null; reportingPeriodEnd: string | null;
    financialYear: string | null; quarter: number | null; currency: string;
    submittedAt: string | null; submittedBy: string | null;
  };
  identity: {
    awardNumber: string | null; awardTitle: string | null; awardedAmount: string | null;
    centreName: string | null; centreNpoNumber: string | null;
    projectTitle: string | null; leadOrganisation: string | null;
  };
  totals: {
    fundingReceived: string; otherIncome: string; totalIncome: string;
    quarterlyExpenditure: string; cumulativeExpenditure: string; totalExpenditure: string;
    surplusDeficit: string; openingBankBalance: string | null; closingBankBalance: string | null;
  };
  narratives: {
    executiveSummary: string | null; objectives: string | null; deliverables: string | null;
    organisationalChanges: string | null; communityChanges: string | null; challenges: string | null;
    lessonsLearned: string | null; nextSteps: string | null; financial: string | null;
  };
  financialLines: GrantReportExportFinancialLine[];
  indicators: Array<{
    id: string; objective: string; deliverable: string | null; indicator: string;
    baseline: string | null; target: string | null; achieved: string | null; status: string;
    progressNarrative: string | null; meansOfVerification: string | null;
  }>;
  beneficiaries: Array<{ category: string; total: number; male: number; female: number }>;
  racialProfile: Array<{ racialGroup: string; children: number; youth: number; men: number; women: number; olderPersons: number; peopleWithDisabilities: number }>;
  sustainability: Array<{ plan: string; progressToDate: string }>;
  certifications: Array<{
    party: string; name: string; designation: string; certificationDate: string | null;
    digitallyConfirmed: boolean; confirmedAt: string | null; confirmationText: string | null;
  }>;
  evidence: GrantReportExportEvidence[];
  readiness: {
    state: "READY" | "NEEDS_REVIEW" | null; warningAcknowledged: boolean;
    warnings: Array<{ id: string; group: string; title: string; detail: string }> | null;
  };
  historicalIntegrity: {
    usesVersionOwnedContent: true; exactLegacyReproductionClaimed: false; unavailableSnapshots: string[];
  };
};
