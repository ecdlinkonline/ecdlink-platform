import { Prisma, type GrantBankImportStatus, type GrantBankTransactionDirection, type GrantBankTransactionType, type GrantFinancialLineType } from "@prisma/client";
import { expectedGrantBankStatementMonths } from "@/lib/grant-reports/bank-import";

export type FinancialReconciliationSeverity = "INFORMATION" | "WARNING" | "BLOCKING";
export type FinancialReadiness = "READY" | "NEEDS_REVIEW" | "BLOCKED";

type EvidenceInput = {
  id: string;
  appliedAmount: Prisma.Decimal;
  transactionTypeSnapshot: GrantBankTransactionType;
  categorySnapshot: string;
  transaction: {
    id: string;
    transactionDate: Date;
    originalDescription: string;
    originalAmount: Prisma.Decimal;
    direction: GrantBankTransactionDirection;
    runningBalance: Prisma.Decimal | null;
    sourcePage: number | null;
    sourceRow: number | null;
    confirmedCategory: string | null;
    statement: { id: string; statementMonth: Date | null; periodStart: Date | null; periodEnd: Date | null; file: { originalFilename: string } };
    batch: { id: string; status: GrantBankImportStatus; originatingGrantReportId: string; grantAwardId: string; centreId: string; financialYear: string; quarter: number };
  };
};

export type ReconciliationFinancialLineInput = {
  id: string;
  lineType: GrantFinancialLineType;
  categoryCode: string | null;
  categoryName: string;
  quarterlyBudget: Prisma.Decimal | null;
  quarterlyActual: Prisma.Decimal | null;
  estimatedExpenditure: Prisma.Decimal | null;
  bankTransactionSources: EvidenceInput[];
};

export type ReconciliationImportInput = {
  id: string;
  status: GrantBankImportStatus;
  statements: Array<{
    id: string;
    statementMonth: Date | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    openingBalance: Prisma.Decimal | null;
    closingBalance: Prisma.Decimal | null;
    transactions: Array<{ direction: GrantBankTransactionDirection; originalAmount: Prisma.Decimal }>;
  }>;
};

export type FinancialReconciliationInput = {
  reportId: string;
  awardId: string;
  centreId: string;
  financialYear: string | null;
  quarter: number | null;
  reportingPeriodStart: Date | null;
  reportingPeriodEnd: Date | null;
  openingCashBalance: Prisma.Decimal | null;
  storedFundingReceivedTotal: Prisma.Decimal;
  storedOtherIncomeTotal: Prisma.Decimal;
  storedTotalIncome: Prisma.Decimal;
  storedTotalExpenditure: Prisma.Decimal;
  financialLines: ReconciliationFinancialLineInput[];
  imports: ReconciliationImportInput[];
};

const zero = () => new Prisma.Decimal(0);
const sum = (values: Prisma.Decimal[]) => values.reduce((total, value) => total.plus(value), zero());
const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2).toFixed(2);
const actualForLine = (line: ReconciliationFinancialLineInput) => line.lineType === "EXPENDITURE"
  ? line.estimatedExpenditure ?? line.quarterlyActual ?? zero()
  : line.quarterlyActual ?? zero();

function mapEvidence(source: EvidenceInput) {
  return {
    sourceId: source.id,
    transactionId: source.transaction.id,
    transactionDate: source.transaction.transactionDate.toISOString(),
    originalDescription: source.transaction.originalDescription,
    direction: source.transaction.direction,
    transactionAmount: money(source.transaction.originalAmount),
    runningBalance: source.transaction.runningBalance ? money(source.transaction.runningBalance) : null,
    confirmedCategory: source.transaction.confirmedCategory ?? source.categorySnapshot,
    statementId: source.transaction.statement.id,
    statementFilename: source.transaction.statement.file.originalFilename,
    statementMonth: (source.transaction.statement.statementMonth ?? source.transaction.statement.periodEnd ?? source.transaction.statement.periodStart)?.toISOString() ?? null,
    sourcePage: source.transaction.sourcePage,
    sourceRow: source.transaction.sourceRow,
    appliedAmount: money(source.appliedAmount),
  };
}

export function buildFinancialReconciliation(input: FinancialReconciliationInput) {
  const warnings: Array<{ severity: FinancialReconciliationSeverity; code: string; message: string }> = [];
  const incomeLines = input.financialLines.filter((line) => line.lineType === "FUNDING_RECEIVED" || line.lineType === "OTHER_INCOME");
  const expenseLines = input.financialLines.filter((line) => line.lineType === "EXPENDITURE");
  const fundingReceived = sum(incomeLines.filter((line) => line.lineType === "FUNDING_RECEIVED").map(actualForLine));
  const otherIncome = sum(incomeLines.filter((line) => line.lineType === "OTHER_INCOME").map(actualForLine));
  const totalCashReceived = fundingReceived.plus(otherIncome);
  const openingCashBalance = input.openingCashBalance ?? zero();
  const totalCashAvailable = openingCashBalance.plus(totalCashReceived);
  const hasTotalBudget = expenseLines.some((line) => line.quarterlyBudget !== null);
  const totalBudget = sum(expenseLines.map((line) => line.quarterlyBudget ?? zero()));
  const totalActual = sum(expenseLines.map(actualForLine));
  const budgetVariance = totalBudget.minus(totalActual);

  const categoryMap = new Map<string, ReconciliationFinancialLineInput[]>();
  for (const line of expenseLines) categoryMap.set(line.categoryName, [...(categoryMap.get(line.categoryName) ?? []), line]);

  for (const line of input.financialLines) {
    const actual = actualForLine(line);
    const linkedAmount = sum(line.bankTransactionSources.map((source) => source.appliedAmount));
    if (linkedAmount.greaterThan(actual)) warnings.push({ severity: "BLOCKING", code: "EVIDENCE_EXCEEDS_LINE", message: `${line.categoryName} has bank evidence greater than its authoritative report line amount.` });
    if (line.categoryCode?.startsWith("BANK_IMPORT:") && (line.bankTransactionSources.length === 0 || !linkedAmount.equals(actual))) {
      warnings.push({ severity: "BLOCKING", code: "INCOMPLETE_BANK_PROVENANCE", message: `${line.categoryName} was posted by a bank import but its linked source amount does not equal the report line.` });
    }
    for (const source of line.bankTransactionSources) {
      const batch = source.transaction.batch;
      const expectedDirection = line.lineType === "EXPENDITURE" ? "DEBIT" : "CREDIT";
      if (source.categorySnapshot !== line.categoryName || source.transaction.direction !== expectedDirection || !source.appliedAmount.equals(source.transaction.originalAmount) || batch.status !== "CONFIRMED" || batch.originatingGrantReportId !== input.reportId || batch.grantAwardId !== input.awardId || batch.centreId !== input.centreId || batch.financialYear !== input.financialYear || batch.quarter !== input.quarter) {
        warnings.push({ severity: "BLOCKING", code: "BROKEN_BANK_PROVENANCE", message: `${line.categoryName} contains bank evidence that is not aligned with this report, award, centre, reporting period or transaction direction.` });
      }
    }
  }

  const categories = [...categoryMap.entries()].map(([categoryName, lines]) => {
    const hasBudget = lines.some((line) => line.quarterlyBudget !== null);
    const budget = sum(lines.map((line) => line.quarterlyBudget ?? zero()));
    const actual = sum(lines.map(actualForLine));
    const sources = lines.flatMap((line) => line.bankTransactionSources);
    const bankAmount = sum(sources.map((source) => source.appliedAmount));
    const manualAmount = Prisma.Decimal.max(actual.minus(bankAmount), zero());
    const variance = budget.minus(actual);
    if (hasBudget && actual.greaterThan(budget)) warnings.push({ severity: "WARNING", code: "OVER_BUDGET", message: `${categoryName} exceeds its quarterly budget by ${money(actual.minus(budget))}.` });
    return {
      categoryName,
      lineIds: lines.map((line) => line.id),
      budget: hasBudget ? money(budget) : null,
      actual: money(actual),
      variance: hasBudget ? money(variance) : null,
      status: !hasBudget ? "BUDGET_NOT_RECORDED" as const : variance.isNegative() ? "OVER_BUDGET" as const : "WITHIN_BUDGET" as const,
      sourceType: sources.length === 0 ? "MANUAL" as const : manualAmount.isZero() ? "BANK" as const : "MIXED" as const,
      bankAmount: money(bankAmount),
      manualAmount: money(manualAmount),
      evidenceTotal: money(bankAmount),
      evidence: sources.map(mapEvidence),
    };
  });

  const allSources = input.financialLines.flatMap((line) => line.bankTransactionSources);
  const uniqueSources = [...new Map(allSources.map((source) => [source.transaction.id, source])).values()];
  const confirmedCredits = sum(uniqueSources.filter((source) => source.transaction.direction === "CREDIT").map((source) => source.appliedAmount));
  const confirmedDebits = sum(uniqueSources.filter((source) => source.transaction.direction === "DEBIT").map((source) => source.appliedAmount));
  const bankSupportedAmount = sum(allSources.map((source) => source.appliedAmount));
  const manualAmounts = input.financialLines.map((line) => Prisma.Decimal.max(actualForLine(line).minus(sum(line.bankTransactionSources.map((source) => source.appliedAmount))), zero()));
  const manualAmount = sum(manualAmounts);
  const manualLineCount = input.financialLines.filter((line, index) => manualAmounts[index].greaterThan(0)).length;
  const linesWithoutEvidence = input.financialLines.filter((line) => actualForLine(line).greaterThan(0) && line.bankTransactionSources.length === 0).length;
  if (manualLineCount > 0) warnings.push({ severity: "INFORMATION", code: "MANUAL_ENTRIES", message: `${manualLineCount} financial line${manualLineCount === 1 ? " is" : "s are"} wholly or partly manual and should be reviewed with supporting records.` });
  if (totalCashAvailable.minus(totalActual).isNegative()) warnings.push({ severity: "WARNING", code: "NEGATIVE_CASH_POSITION", message: "Recorded expenditure exceeds the cash available for this quarter." });

  if (!fundingReceived.equals(input.storedFundingReceivedTotal) || !otherIncome.equals(input.storedOtherIncomeTotal) || !totalCashReceived.equals(input.storedTotalIncome) || !totalActual.equals(input.storedTotalExpenditure)) {
    warnings.push({ severity: "BLOCKING", code: "FINANCIAL_TOTAL_MISMATCH", message: "Stored report totals do not match the authoritative financial lines." });
  }

  const relevantImports = input.imports;
  if (allSources.length > 0 && !relevantImports.some((batch) => batch.status === "CONFIRMED")) warnings.push({ severity: "BLOCKING", code: "IMPORT_NOT_CONFIRMED", message: "Bank evidence is present, but its import batch is not confirmed." });
  else if (relevantImports.some((batch) => batch.status !== "CONFIRMED")) warnings.push({ severity: "WARNING", code: "UNCONFIRMED_IMPORT", message: "An additional bank import for this reporting period has not been confirmed." });

  const confirmedImports = relevantImports.filter((batch) => batch.status === "CONFIRMED");
  if (input.reportingPeriodStart && input.reportingPeriodEnd && confirmedImports.length > 0) {
    const expectedMonths = expectedGrantBankStatementMonths(input.reportingPeriodStart.toISOString().slice(0, 10), input.reportingPeriodEnd.toISOString().slice(0, 10));
    const actualMonths = new Set(confirmedImports.flatMap((batch) => batch.statements.map((statement) => (statement.statementMonth ?? statement.periodEnd ?? statement.periodStart)?.toISOString().slice(0, 7))).filter(Boolean));
    const missingMonths = expectedMonths.filter((month) => !actualMonths.has(month.value.slice(0, 7)));
    if (missingMonths.length) warnings.push({ severity: "WARNING", code: "MISSING_STATEMENT_MONTH", message: `Bank statements are missing for ${missingMonths.map((month) => month.label).join(", ")}.` });
  }

  for (const batch of confirmedImports) {
    for (const statement of batch.statements) {
      if (!statement.openingBalance || !statement.closingBalance) continue;
      const credits = sum(statement.transactions.filter((row) => row.direction === "CREDIT").map((row) => row.originalAmount));
      const debits = sum(statement.transactions.filter((row) => row.direction === "DEBIT").map((row) => row.originalAmount));
      const expectedClosing = statement.openingBalance.plus(credits).minus(debits);
      if (!expectedClosing.equals(statement.closingBalance)) {
        const statementDate = statement.statementMonth ?? statement.periodEnd ?? statement.periodStart;
        const statementLabel = statementDate ? new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }).format(statementDate) : "A source bank statement";
        warnings.push({ severity: "WARNING", code: "SOURCE_STATEMENT_DISCREPANCY", message: `${statementLabel} does not reconcile to its extracted opening balance, transactions and closing balance (difference ${money(statement.closingBalance.minus(expectedClosing))}).` });
      }
    }
  }

  const readiness: FinancialReadiness = warnings.some((warning) => warning.severity === "BLOCKING")
    ? "BLOCKED"
    : warnings.length > 0 ? "NEEDS_REVIEW" : "READY";

  return {
    readiness,
    warnings,
    cash: { openingCashBalance: input.openingCashBalance ? money(input.openingCashBalance) : null, fundingReceived: money(fundingReceived), otherIncome: money(otherIncome), totalCashReceived: money(totalCashReceived), totalCashAvailable: money(totalCashAvailable) },
    expenditure: { quarterlyBudget: hasTotalBudget ? money(totalBudget) : null, actualExpenditure: money(totalActual), remainingBudget: hasTotalBudget ? money(budgetVariance) : null, budgetVariance: hasTotalBudget ? money(budgetVariance) : null },
    bankPosition: { confirmedCredits: money(confirmedCredits), confirmedDebits: money(confirmedDebits), netMovement: money(confirmedCredits.minus(confirmedDebits)) },
    coverage: { bankSourcedFinancialLines: input.financialLines.filter((line) => line.bankTransactionSources.length > 0).length, supportingBankTransactions: uniqueSources.length, manualFinancialLines: manualLineCount, bankSupportedAmount: money(bankSupportedAmount), manualAmount: money(manualAmount), linesWithoutBankEvidence: linesWithoutEvidence },
    sourceLines: input.financialLines.filter((line) => actualForLine(line).greaterThan(0)).map((line) => {
      const actual = actualForLine(line);
      const bankAmount = sum(line.bankTransactionSources.map((source) => source.appliedAmount));
      const manualAmount = Prisma.Decimal.max(actual.minus(bankAmount), zero());
      return { id: line.id, lineType: line.lineType, categoryName: line.categoryName, actual: money(actual), bankAmount: money(bankAmount), manualAmount: money(manualAmount), sourceType: line.bankTransactionSources.length === 0 ? "MANUAL" as const : manualAmount.isZero() ? "BANK" as const : "MIXED" as const, evidence: line.bankTransactionSources.map(mapEvidence) };
    }),
    categories,
  };
}
