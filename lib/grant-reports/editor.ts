export const nlcGrantReportSections = [
  { id: "general", label: "General Information" },
  { id: "objectives", label: "Objectives & Deliverables" },
  { id: "beneficiaries", label: "Beneficiaries" },
  { id: "sustainability", label: "Sustainability & Challenges" },
  { id: "financial", label: "Financial Progress" },
  { id: "documents", label: "Supporting Documents" },
  { id: "certification", label: "Certification & Review" },
] as const;

export type NlcGrantReportSectionId = (typeof nlcGrantReportSections)[number]["id"];

export const grantReportBeneficiaryCategories = [
  "CHILDREN_0_18",
  "YOUTH_18_35",
  "ADULTS_35_65",
  "OLDER_PERSONS_65_PLUS",
  "PEOPLE_WITH_DISABILITIES",
] as const;

export const grantReportRacialGroups = ["AFRICAN", "COLOURED", "INDIAN_ASIAN", "WHITE"] as const;
export const grantReportCertificationParties = ["COMPILER", "APPROVER"] as const;

export function resolveGrantReportTemplate(reportType: string) {
  return reportType === "INTERIM" || reportType === "FINAL" ? "NLC" : "COMING_SOON";
}

export function isGrantReportVersionEditable(reportStatus: string, versionStatus: string) {
  return versionStatus === "DRAFT" && !["SUBMITTED", "APPROVED", "ARCHIVED"].includes(reportStatus);
}

export function buildSuggestedGrantIndicators(project: { title: string; objective: string | null; expectedOutcomes: string[]; requiredItems: string[] }, existingIndicatorCount: number) {
  if (existingIndicatorCount > 0) return [];
  if (project.expectedOutcomes.length) return project.expectedOutcomes.map((outcome, index) => ({
    objective: project.objective ?? project.title,
    deliverable: outcome,
    achieved: "",
    status: "NOT_STARTED" as const,
    meansOfVerification: index === 0 ? project.requiredItems.join("; ") : "",
  }));
  return project.objective ? [{ objective: project.objective, deliverable: "", achieved: "", status: "NOT_STARTED" as const, meansOfVerification: project.requiredItems.join("; ") }] : [];
}

function decimalParts(value: string) {
  const normalized = value.trim();
  const match = /^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const cents = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] === "-" ? -cents : cents;
}

function centsToDecimal(value: number) {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export function subtractGrantAmounts(left: string, right: string) {
  const leftCents = decimalParts(left);
  const rightCents = decimalParts(right);
  if (leftCents === null || rightCents === null) return null;
  return centsToDecimal(leftCents - rightCents);
}

export function calculateRacialRowTotal(row: {
  children: number;
  youth: number;
  men: number;
  women: number;
  olderPersons: number;
  peopleWithDisabilities: number;
}) {
  return row.children + row.youth + row.men + row.women + row.olderPersons + row.peopleWithDisabilities;
}

export function calculateRacialColumnTotals(rows: Array<{
  children: number;
  youth: number;
  men: number;
  women: number;
  olderPersons: number;
  peopleWithDisabilities: number;
}>) {
  return rows.reduce<{
    children: number;
    youth: number;
    men: number;
    women: number;
    olderPersons: number;
    peopleWithDisabilities: number;
    total: number;
  }>((totals, row) => ({
    children: totals.children + row.children,
    youth: totals.youth + row.youth,
    men: totals.men + row.men,
    women: totals.women + row.women,
    olderPersons: totals.olderPersons + row.olderPersons,
    peopleWithDisabilities: totals.peopleWithDisabilities + row.peopleWithDisabilities,
    total: totals.total + calculateRacialRowTotal(row),
  }), { children: 0, youth: 0, men: 0, women: 0, olderPersons: 0, peopleWithDisabilities: 0, total: 0 });
}

export function grantReportCompletion(input: {
  reportType: string;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  indicatorCount: number;
  beneficiaryCount: number;
  racialRowCount: number;
  challenges: string | null;
  sustainabilityCount: number;
  financialLineCount: number;
  certificationCount: number;
  confirmedCertificationCount: number;
  hasAuditedFinancialStatements: boolean;
}) {
  const checks = [
    Boolean(input.reportingPeriodStart && input.reportingPeriodEnd),
    input.indicatorCount > 0,
    input.beneficiaryCount === grantReportBeneficiaryCategories.length,
    input.racialRowCount === grantReportRacialGroups.length,
    Boolean(input.challenges?.trim()) && input.sustainabilityCount > 0,
    input.financialLineCount > 0,
    input.certificationCount === grantReportCertificationParties.length && input.confirmedCertificationCount === grantReportCertificationParties.length,
    input.reportType !== "FINAL" || input.hasAuditedFinancialStatements,
  ];
  const complete = checks.filter(Boolean).length;
  return {
    percentage: Math.round((complete / checks.length) * 100),
    structurallyComplete: complete === checks.length,
    readyForSubmission: complete === checks.length,
    completedChecks: complete,
    totalChecks: checks.length,
  };
}
