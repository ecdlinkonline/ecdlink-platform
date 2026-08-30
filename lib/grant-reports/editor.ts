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

export const dbeQuarterlyExpenditureSections = [
  { id: "quarterly_general", label: "General Information" },
  { id: "quarterly_income", label: "Income" },
  { id: "quarterly_expenditure", label: "Expenditure" },
  { id: "bank_reconciliation", label: "Bank Reconciliation" },
  { id: "certification", label: "Certification & Review" },
] as const;

export type DbeQuarterlyExpenditureSectionId = (typeof dbeQuarterlyExpenditureSections)[number]["id"];

export const dbeQuarterlyCashFlowSections = [
  { id: "cash_flow_general", label: "General Information" },
  { id: "cash_received", label: "Cash Received" },
  { id: "operating_expenses", label: "Operating Expenses" },
  { id: "variance_review", label: "Variance & Reasons" },
  { id: "certification", label: "Certification & Review" },
] as const;

export type DbeQuarterlyCashFlowSectionId = (typeof dbeQuarterlyCashFlowSections)[number]["id"];

export const dbeQuarterlyExpenditureCategories = [
  "Nutritional Requirements",
  "Facility / Rent / Utilities",
  "Administration / Governance",
  "Bookkeeping / Audit",
  "Transport",
  "Educational / Learning Materials",
  "Programme Stimulation",
  "Practitioner / Staff Costs",
  "Cook / Nutrition Support",
  "Cleaning Materials",
  "Gardening / Healthy Environment",
  "Bank Charges",
  "Office Expenses",
  "Assets",
  "Other Expenses",
] as const;

export const dbeQuarterlyCashFlowExpenseCategories = [
  "Principal",
  "Practitioners",
  "Bookkeeper",
  "Cleaner",
  "Cooker",
  "Gardener",
  "Electricity / Rent / Telephone / Stationery",
  "Cleaning Materials",
  "Toys",
  "Audit Fees",
  "Nutrition",
  "Bank Charges",
  "Transport",
  "Other Operating Expenses",
] as const;

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
  if (reportType === "INTERIM" || reportType === "FINAL") return "NLC";
  if (reportType === "QUARTERLY_EXPENDITURE") return "DBE_QUARTERLY_EXPENDITURE";
  if (reportType === "QUARTERLY_CASH_FLOW") return "DBE_QUARTERLY_CASH_FLOW";
  return "COMING_SOON";
}

export function buildQuarterlyExpenditureSubtitle(input: {
  reportTitle: string;
  centreName: string | null;
  leadOrganisation: string | null;
  financialYear: string | null;
  quarter: number | null;
}) {
  const quarterContext = input.quarter && input.financialYear ? `Q${input.quarter} ${input.financialYear}` : null;
  const strippedTitle = input.reportTitle.trim().replace(/^Quarterly Expenditure Report\s*(?:[-–—:]\s*)?/i, "").trim();
  const usefulTitle = strippedTitle && strippedTitle.toLocaleLowerCase() !== quarterContext?.toLocaleLowerCase() ? strippedTitle : null;
  const seen = new Set<string>();

  return [usefulTitle, input.centreName, input.leadOrganisation, quarterContext]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value) => {
      const normalized = value.trim().toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join(" · ");
}

export function buildQuarterlyCashFlowSubtitle(input: {
  reportTitle: string;
  centreName: string | null;
  leadOrganisation: string | null;
  financialYear: string | null;
  quarter: number | null;
}) {
  const quarterContext = input.quarter && input.financialYear ? `Q${input.quarter} ${input.financialYear}` : null;
  const strippedTitle = input.reportTitle.trim().replace(/^Quarterly Cash Flow Report\s*(?:[-–—:]\s*)?/i, "").trim();
  const usefulTitle = strippedTitle && strippedTitle.toLocaleLowerCase() !== quarterContext?.toLocaleLowerCase() ? strippedTitle : null;
  const seen = new Set<string>();
  return [usefulTitle, input.centreName, input.leadOrganisation, quarterContext]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value) => {
      const normalized = value.trim().toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join(" · ");
}

export function mapQuarterlyExpenditureIncomeToCashReceived(rows: Array<{ lineType: "FUNDING_RECEIVED" | "OTHER_INCOME"; categoryName: string; amount: string | null }>) {
  return rows.map((row) => ({
    lineType: row.lineType,
    categoryName: row.lineType === "FUNDING_RECEIVED" ? "Subsidy" : /^other income$/i.test(row.categoryName.trim()) ? "Other Income" : row.categoryName,
    amount: row.amount,
  }));
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

export function sumGrantAmounts(values: Array<string | null | undefined>) {
  let total = 0;
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const cents = decimalParts(value);
    if (cents === null) return null;
    total += cents;
  }
  return centsToDecimal(total);
}

export function addGrantAmounts(left: string | null | undefined, right: string | null | undefined) {
  return sumGrantAmounts([left, right]);
}

export function subtractGrantAmounts(left: string, right: string) {
  const leftCents = decimalParts(left);
  const rightCents = decimalParts(right);
  if (leftCents === null || rightCents === null) return null;
  return centsToDecimal(leftCents - rightCents);
}

export function quarterlyExpenditureTotals(rows: Array<{
  quarterlyBudget: string | null;
  fundingSourceActual: string | null;
  otherSourceActual: string | null;
}>) {
  const totalAllocatedBudget = sumGrantAmounts(rows.map((row) => row.quarterlyBudget));
  const totalFundingSourceExpenditure = sumGrantAmounts(rows.map((row) => row.fundingSourceActual));
  const totalOtherSourceExpenditure = sumGrantAmounts(rows.map((row) => row.otherSourceActual));
  const totalExpenditure = addGrantAmounts(totalFundingSourceExpenditure, totalOtherSourceExpenditure);
  return { totalAllocatedBudget, totalFundingSourceExpenditure, totalOtherSourceExpenditure, totalExpenditure };
}

export function quarterlyCashFlowTotals(cashReceived: Array<string | null | undefined>, expenses: Array<{ quarterlyBudget: string | null; estimatedExpenditure: string | null }>) {
  const totalCashAvailable = sumGrantAmounts(cashReceived);
  const totalQuarterlyBudget = sumGrantAmounts(expenses.map((row) => row.quarterlyBudget));
  const totalExpenditure = sumGrantAmounts(expenses.map((row) => row.estimatedExpenditure));
  const totalVariance = totalQuarterlyBudget === null || totalExpenditure === null ? null : subtractGrantAmounts(totalQuarterlyBudget, totalExpenditure);
  const remainingCash = totalCashAvailable === null || totalExpenditure === null ? null : subtractGrantAmounts(totalCashAvailable, totalExpenditure);
  return { totalCashAvailable, totalQuarterlyBudget, totalExpenditure, totalVariance, remainingCash };
}

export function quarterlyCashFlowCompletion(input: {
  financialYear: string | null;
  quarter: number | null;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  cashReceivedLineCount: number;
  operatingExpenseLineCount: number;
  unresolvedVarianceCount: number;
  certificationCount: number;
  confirmedCertificationCount: number;
}) {
  const checks = [
    Boolean(input.financialYear && input.quarter && input.reportingPeriodStart && input.reportingPeriodEnd),
    input.cashReceivedLineCount > 0,
    input.operatingExpenseLineCount > 0,
    input.unresolvedVarianceCount === 0,
    input.certificationCount === grantReportCertificationParties.length && input.confirmedCertificationCount === grantReportCertificationParties.length,
  ];
  const complete = checks.filter(Boolean).length;
  return { percentage: Math.round((complete / checks.length) * 100), structurallyComplete: complete === checks.length, readyForSubmission: complete === checks.length, completedChecks: complete, totalChecks: checks.length };
}

export function quarterlyExpenditureCompletion(input: {
  financialYear: string | null;
  quarter: number | null;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  incomeLineCount: number;
  expenditureLineCount: number;
  openingBankBalance: string | null;
  closingBankBalance: string | null;
  certificationCount: number;
  confirmedCertificationCount: number;
}) {
  const checks = [
    Boolean(input.financialYear && input.quarter && input.reportingPeriodStart && input.reportingPeriodEnd),
    input.incomeLineCount > 0,
    input.expenditureLineCount > 0,
    input.openingBankBalance !== null && input.closingBankBalance !== null,
    input.certificationCount === grantReportCertificationParties.length && input.confirmedCertificationCount === grantReportCertificationParties.length,
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
