import { dbeQuarterlyCashFlowExpenseCategories, dbeQuarterlyExpenditureCategories, sumGrantAmounts, subtractGrantAmounts } from "@/lib/grant-reports/editor";
import { resolveQuarterlyReportingPeriod } from "@/lib/grant-reports/quarterly-period";

export const financialQaClassifications = ["CONFIRMED_INCONSISTENCY", "POTENTIAL_INCONSISTENCY", "INSUFFICIENT_INFORMATION", "INFORMATIONAL"] as const;
export type FinancialQaClassification = typeof financialQaClassifications[number];
export type FinancialQaAnnualState = "COMPLETE" | "PROVISIONAL" | "UNAVAILABLE";

export type FinancialQaLine = { lineType: string; categoryCode: string | null; categoryName: string; quarterlyActual: string | null; estimatedExpenditure: string | null };
export type FinancialQaVersion = {
  reportId: string; versionNumber: number; authority: "SUBMITTED" | "DRAFT"; currency: string;
  totalIncome: string; totalExpenditure: string; quarterlyExpenditureTotal: string; cumulativeExpenditureTotal: string;
  openingBankBalance: string | null; closingBankBalance: string | null; financialLines: FinancialQaLine[];
  hasRecordedFinancialActivity: boolean;
  bankEvidence: { openingBalance: string | null; closingBalance: string | null; accountFingerprints: string[]; currencies: string[] } | null;
};
export type FinancialQaQuarter = {
  financialYear: string; quarter: 1 | 2 | 3 | 4; reportType: "QUARTERLY_CASH_FLOW" | "QUARTERLY_EXPENDITURE";
  reportingPeriodStart: string; reportingPeriodEnd: string; coverageState: string; reportId: string | null; version: FinancialQaVersion | null;
};
export type FinancialQaFinding = {
  code: string; classification: FinancialQaClassification; financialYear: string; quarter: number | null;
  reportType: FinancialQaQuarter["reportType"]; reportId: string | null; versionNumber: number | null;
  relatedFinancialYear?: string; relatedQuarter?: number; relatedReportId?: string | null; relatedVersionNumber?: number | null;
  currency?: string; expectedAmount?: string; actualAmount?: string; difference?: string; explanation: string; recommendedAction: string;
};

export function financialQaQuarterAmountDisplayState(quarter: { authority: "SUBMITTED" | "DRAFT" | null; hasRecordedFinancialActivity: boolean }) {
  if (!quarter.authority) return "UNAVAILABLE" as const;
  if (quarter.authority === "DRAFT" && !quarter.hasRecordedFinancialActivity) return "NOT_RECORDED" as const;
  return "RECORDED" as const;
}

export function hasRecordedFinancialActivity(lines: FinancialQaLine[]) {
  return lines.some((line) => line.quarterlyActual !== null || line.estimatedExpenditure !== null);
}

const knownCategories = new Set<string>([
  ...dbeQuarterlyCashFlowExpenseCategories, ...dbeQuarterlyExpenditureCategories,
  "Salaries / Stipends", "Nutrition / Groceries", "Educational / Learning Materials", "Maintenance / Repairs",
  "Utilities / Rent / Communications", "Other / Unclassified",
]);

function canonicalCategory(line: FinancialQaLine) {
  const code = line.categoryCode?.trim();
  if (code && !code.startsWith("BANK_IMPORT:")) return `CODE:${code}`;
  return knownCategories.has(line.categoryName.trim()) ? `STANDARD:${line.categoryName.trim()}` : null;
}
function amountIsNegative(value: string) { return /^-/.test(value) && value !== "-0.00"; }
function officialVersion(quarter: FinancialQaQuarter) { return quarter.coverageState === "SUBMITTED" && isCanonical(quarter) && quarter.version?.authority === "SUBMITTED" ? quarter.version : null; }
function finding(quarter: FinancialQaQuarter, values: Omit<FinancialQaFinding, "financialYear" | "quarter" | "reportType" | "reportId" | "versionNumber">): FinancialQaFinding {
  return { financialYear: quarter.financialYear, quarter: quarter.quarter, reportType: quarter.reportType, reportId: quarter.reportId, versionNumber: quarter.version?.versionNumber ?? null, ...values };
}
function isCanonical(quarter: FinancialQaQuarter) {
  const expected = resolveQuarterlyReportingPeriod(quarter.financialYear, quarter.quarter);
  return Boolean(expected && expected.reportingPeriodStart === quarter.reportingPeriodStart && expected.reportingPeriodEnd === quarter.reportingPeriodEnd);
}
function balances(version: FinancialQaVersion) { return { opening: version.openingBankBalance ?? version.bankEvidence?.openingBalance ?? null, closing: version.closingBankBalance ?? version.bankEvidence?.closingBalance ?? null }; }
function bankIdentity(version: FinancialQaVersion) { const fingerprints = version.bankEvidence?.accountFingerprints ?? []; return fingerprints.length === 1 ? fingerprints[0] : null; }
function bankCurrencyAligned(version: FinancialQaVersion) { const currencies = version.bankEvidence?.currencies ?? []; return currencies.length <= 1 && currencies.every((currency) => currency.toUpperCase() === version.currency.toUpperCase()); }

export function buildQuarterlyFinancialQa(input: { financialYear: string; reportType: FinancialQaQuarter["reportType"]; quarters: FinancialQaQuarter[]; nextFinancialYearQ1: FinancialQaQuarter }) {
  const findings: FinancialQaFinding[] = [];
  const submitted = input.quarters.map(officialVersion).filter((version): version is FinancialQaVersion => Boolean(version));
  const submittedCurrencies = new Set(submitted.map((version) => version.currency.toUpperCase()));
  let runningExpenditure = "0.00";
  const quarterSummaries = input.quarters.map((quarter) => {
    const version = quarter.version;
    const official = officialVersion(quarter);
    if (quarter.coverageState === "MISSING") {
      findings.push(finding(quarter, { code: "QUARTER_MISSING", classification: "INSUFFICIENT_INFORMATION", explanation: `Q${quarter.quarter} has no persisted reporting obligation or report. It is not treated as zero.`, recommendedAction: "Create the reporting period through the controlled lifecycle when it is required." }));
    } else if (quarter.coverageState === "DRAFT" || quarter.coverageState === "OBLIGATION_ONLY") {
      findings.push(finding(quarter, { code: "QUARTER_DRAFT_ONLY", classification: "INFORMATIONAL", explanation: version ? `Q${quarter.quarter} has provisional Draft financial information.` : `Q${quarter.quarter} has an obligation but no report.`, recommendedAction: "Complete and submit the quarter before treating it as an official annual figure." }));
    } else if (["DUPLICATE", "OVERLAPPING", "NONCANONICAL"].includes(quarter.coverageState) || !isCanonical(quarter)) {
      findings.push(finding(quarter, { code: quarter.coverageState === "DUPLICATE" ? "PERIOD_DUPLICATE" : quarter.coverageState === "OVERLAPPING" ? "PERIOD_OVERLAP" : "PERIOD_NONCANONICAL", classification: "CONFIRMED_INCONSISTENCY", explanation: `Q${quarter.quarter} cannot be used for a reliable canonical quarter comparison.`, recommendedAction: "Review the persisted obligation periods without changing submitted history." }));
    }
    if (version) {
      const uncertain = version.financialLines.filter((line) => line.lineType === "EXPENDITURE" && !canonicalCategory(line));
      if (uncertain.length) findings.push(finding(quarter, { code: "CATEGORY_MAPPING_UNCERTAIN", classification: "INSUFFICIENT_INFORMATION", currency: version.currency, explanation: `${uncertain.length} expenditure categor${uncertain.length === 1 ? "y is" : "ies are"} not backed by a stable category identifier.`, recommendedAction: "Review category mapping before making category-level comparisons. Missing categories are not treated as zero." }));
      if (amountIsNegative(version.totalExpenditure)) findings.push(finding(quarter, { code: "EXPENDITURE_DECREASE_REVIEW", classification: "POTENTIAL_INCONSISTENCY", currency: version.currency, actualAmount: version.totalExpenditure, explanation: "The quarter records negative expenditure, which reduces the running total and may represent a legitimate correction, reversal or adjustment.", recommendedAction: "Review the correction and its supporting evidence; do not remove it automatically." }));
      if (!bankCurrencyAligned(version)) findings.push(finding(quarter, { code: "BANK_CURRENCY_MISMATCH", classification: "CONFIRMED_INCONSISTENCY", currency: version.currency, explanation: "Confirmed bank evidence and the historical report version do not use one matching currency.", recommendedAction: "Review the source statement currency. No FX conversion is performed." }));
    }
    if (official) runningExpenditure = sumGrantAmounts([runningExpenditure, official.totalExpenditure]) ?? runningExpenditure;
    return { financialYear: quarter.financialYear, quarter: quarter.quarter, coverageState: quarter.coverageState, reportId: quarter.reportId, versionNumber: version?.versionNumber ?? null, authority: version?.authority ?? null, currency: version?.currency ?? null, hasRecordedFinancialActivity: version?.hasRecordedFinancialActivity ?? false, submittedIncome: official?.totalIncome ?? null, submittedExpenditure: official?.totalExpenditure ?? null, provisionalIncome: version?.authority === "DRAFT" ? version.totalIncome : null, provisionalExpenditure: version?.authority === "DRAFT" ? version.totalExpenditure : null, runningSubmittedExpenditure: official ? runningExpenditure : null };
  });
  if (submittedCurrencies.size > 1) {
    const first = input.quarters.find((quarter) => officialVersion(quarter));
    if (first) findings.push(finding(first, { code: "CURRENCY_MISMATCH", classification: "CONFIRMED_INCONSISTENCY", explanation: "Submitted quarters use different historical report currencies and cannot be aggregated.", recommendedAction: "Review the report-version currencies. No FX conversion is performed." }));
  }
  const stableCategoryLabels = new Map<string, Set<string>>();
  for (const quarter of input.quarters) {
    const official = officialVersion(quarter);
    if (!official) continue;
    for (const line of official.financialLines.filter((item) => item.lineType === "EXPENDITURE")) {
      const key = canonicalCategory(line);
      if (key?.startsWith("CODE:")) stableCategoryLabels.set(key, new Set([...(stableCategoryLabels.get(key) ?? []), line.categoryName.trim()]));
    }
  }
  for (const [key, labels] of stableCategoryLabels) {
    if (labels.size > 1) {
      const first = input.quarters.find((quarter) => officialVersion(quarter)?.financialLines.some((line) => canonicalCategory(line) === key));
      if (first) findings.push(finding(first, { code: "CATEGORY_LABEL_CHANGED", classification: "POTENTIAL_INCONSISTENCY", explanation: `The stable category ${key.slice(5)} has different labels across submitted quarters. Amounts remain associated by the persisted code.`, recommendedAction: "Confirm whether the label change is intentional; do not treat a renamed category as missing expenditure." }));
    }
  }
  const transitions = [...input.quarters.slice(0, 3).map((quarter, index) => [quarter, input.quarters[index + 1]] as const), [input.quarters[3], input.nextFinancialYearQ1] as const].map(([from, to]) => {
    const previous = officialVersion(from); const current = officialVersion(to);
    const base = { fromFinancialYear: from.financialYear, fromQuarter: from.quarter, toFinancialYear: to.financialYear, toQuarter: to.quarter, status: "UNAVAILABLE" as "MATCH" | "MISMATCH" | "UNAVAILABLE", previousClosingBalance: null as string | null, currentOpeningBalance: null as string | null, difference: null as string | null };
    if (!previous || !current || !isCanonical(from) || !isCanonical(to)) {
      findings.push(finding(from, { code: "BALANCE_CONTINUITY_UNAVAILABLE", classification: "INSUFFICIENT_INFORMATION", relatedFinancialYear: to.financialYear, relatedQuarter: to.quarter, relatedReportId: to.reportId, relatedVersionNumber: to.version?.versionNumber ?? null, explanation: `Q${from.quarter} to ${to.financialYear === from.financialYear ? `Q${to.quarter}` : `FY${to.financialYear} Q${to.quarter}`} balance continuity is unavailable because both adjacent canonical submitted versions are not present.`, recommendedAction: "Complete the missing quarter or submission before reviewing continuity." })); return base;
    }
    if (previous.currency.toUpperCase() !== current.currency.toUpperCase() || !bankCurrencyAligned(previous) || !bankCurrencyAligned(current)) {
      findings.push(finding(from, { code: "CURRENCY_MISMATCH", classification: "CONFIRMED_INCONSISTENCY", relatedFinancialYear: to.financialYear, relatedQuarter: to.quarter, relatedReportId: to.reportId, relatedVersionNumber: current.versionNumber, explanation: "Adjacent submitted quarters use different currencies, so balance continuity is unavailable.", recommendedAction: "Review the historical currencies; no FX conversion is performed." })); return base;
    }
    const previousBalances = balances(previous); const currentBalances = balances(current); const previousIdentity = bankIdentity(previous); const currentIdentity = bankIdentity(current);
    const populated = { ...base, previousClosingBalance: previousBalances.closing, currentOpeningBalance: currentBalances.opening };
    if (!previousBalances.closing || !currentBalances.opening) {
      findings.push(finding(from, { code: "BANK_BALANCE_MISSING", classification: "INSUFFICIENT_INFORMATION", relatedFinancialYear: to.financialYear, relatedQuarter: to.quarter, relatedReportId: to.reportId, relatedVersionNumber: current.versionNumber, currency: previous.currency, explanation: "An adjacent submitted quarter is missing its closing or opening bank balance.", recommendedAction: "Review the submitted bank evidence; do not substitute the available grant balance." })); return populated;
    }
    if (!previousIdentity || !currentIdentity || previousIdentity !== currentIdentity) {
      findings.push(finding(from, { code: "BANK_ACCOUNT_UNCONFIRMED", classification: "INSUFFICIENT_INFORMATION", relatedFinancialYear: to.financialYear, relatedQuarter: to.quarter, relatedReportId: to.reportId, relatedVersionNumber: current.versionNumber, currency: previous.currency, expectedAmount: previousBalances.closing, actualAmount: currentBalances.opening, explanation: "The bank account identity is missing, ambiguous or different across the adjacent quarters.", recommendedAction: "Confirm that the balances belong to the same bank account before comparing them." })); return populated;
    }
    const difference = subtractGrantAmounts(currentBalances.opening, previousBalances.closing);
    if (difference !== "0.00") {
      findings.push(finding(from, { code: "BANK_BALANCE_DISCONTINUITY", classification: "CONFIRMED_INCONSISTENCY", relatedFinancialYear: to.financialYear, relatedQuarter: to.quarter, relatedReportId: to.reportId, relatedVersionNumber: current.versionNumber, currency: previous.currency, expectedAmount: previousBalances.closing, actualAmount: currentBalances.opening, difference: difference ?? undefined, explanation: "The next quarter opening bank balance does not equal the previous quarter closing bank balance for the confirmed account.", recommendedAction: "Review bank evidence and explain the difference without changing submitted history." })); return { ...populated, status: "MISMATCH" as const, difference };
    }
    return { ...populated, status: "MATCH" as const, difference };
  });
  const currenciesCompatible = submittedCurrencies.size <= 1;
  const allSubmitted = input.quarters.every((quarter) => officialVersion(quarter));
  const state: FinancialQaAnnualState = submitted.length === 0 || !currenciesCompatible ? "UNAVAILABLE" : allSubmitted ? "COMPLETE" : "PROVISIONAL";
  const currency = submittedCurrencies.size === 1 ? [...submittedCurrencies][0] : null;
  return { state, currency, totalSubmittedIncome: currenciesCompatible && submitted.length ? sumGrantAmounts(submitted.map((version) => version.totalIncome)) : null, totalSubmittedExpenditure: currenciesCompatible && submitted.length ? sumGrantAmounts(submitted.map((version) => version.totalExpenditure)) : null, quarterSummaries, transitions, findings };
}
