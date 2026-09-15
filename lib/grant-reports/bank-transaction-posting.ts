import { Prisma, type GrantBankTransactionDirection, type GrantBankTransactionType } from "@prisma/client";

export type GrantBankPostingTreatment = "CASH_RECEIVED" | "OPERATING_EXPENSE" | "NEEDS_POSTING_REVIEW";

export type GrantBankPostingMapping = {
  treatment: GrantBankPostingTreatment;
  lineType: "FUNDING_RECEIVED" | "OTHER_INCOME" | "EXPENDITURE" | null;
  reportCategory: string | null;
  safe: boolean;
  reason: string | null;
};

const expenseCategories = new Set([
  "Bank Charges",
  "Salaries / Stipends",
  "Nutrition / Groceries",
  "Transport",
  "Educational / Learning Materials",
  "Maintenance / Repairs",
  "Utilities / Rent / Communications",
  "Cleaning Materials",
  "Other Operating Expenses",
]);

export function mapConfirmedTransactionToCashFlow(input: {
  direction: GrantBankTransactionDirection;
  confirmedType: GrantBankTransactionType;
  confirmedCategory: string;
}): GrantBankPostingMapping {
  if (input.confirmedCategory === "Funding / Subsidy Income" && input.confirmedType === "INCOME" && input.direction === "CREDIT") {
    return { treatment: "CASH_RECEIVED", lineType: "FUNDING_RECEIVED", reportCategory: input.confirmedCategory, safe: true, reason: null };
  }
  if (input.confirmedCategory === "Other Income" && input.confirmedType === "INCOME" && input.direction === "CREDIT") {
    return { treatment: "CASH_RECEIVED", lineType: "OTHER_INCOME", reportCategory: input.confirmedCategory, safe: true, reason: null };
  }
  const expectedExpenseType = input.confirmedCategory === "Bank Charges" ? "BANK_CHARGE" : "EXPENSE";
  if (expenseCategories.has(input.confirmedCategory) && input.direction === "DEBIT" && input.confirmedType === expectedExpenseType) {
    return { treatment: "OPERATING_EXPENSE", lineType: "EXPENDITURE", reportCategory: input.confirmedCategory, safe: true, reason: null };
  }
  if (input.confirmedCategory === "Other / Unclassified" && input.confirmedType === "UNKNOWN") {
    return input.direction === "DEBIT"
      ? { treatment: "OPERATING_EXPENSE", lineType: "EXPENDITURE", reportCategory: input.confirmedCategory, safe: true, reason: null }
      : { treatment: "CASH_RECEIVED", lineType: "OTHER_INCOME", reportCategory: input.confirmedCategory, safe: true, reason: null };
  }
  return {
    treatment: "NEEDS_POSTING_REVIEW",
    lineType: null,
    reportCategory: null,
    safe: false,
    reason: input.confirmedType === "TRANSFER" || input.confirmedType === "REVERSAL_REFUND"
      ? "Transfers and reversals require an accounting decision before posting."
      : "The confirmed category, type and bank direction do not form a safe cash-flow mapping.",
  };
}

export function calculateGrantBankPostingTotals(rows: Array<{ direction: GrantBankTransactionDirection; amount: Prisma.Decimal; mapping: GrantBankPostingMapping }>) {
  return rows.reduce((totals, row) => {
    if (row.direction === "CREDIT") totals.confirmedCredits = totals.confirmedCredits.plus(row.amount);
    else totals.confirmedDebits = totals.confirmedDebits.plus(row.amount);
    if (row.mapping.treatment === "CASH_RECEIVED") totals.proposedCashReceived = totals.proposedCashReceived.plus(row.amount);
    if (row.mapping.treatment === "OPERATING_EXPENSE") totals.proposedOperatingExpenses = totals.proposedOperatingExpenses.plus(row.amount);
    if (!row.mapping.safe) totals.unmapped += 1;
    totals.netMovement = totals.confirmedCredits.minus(totals.confirmedDebits);
    return totals;
  }, {
    confirmedCredits: new Prisma.Decimal(0),
    confirmedDebits: new Prisma.Decimal(0),
    proposedCashReceived: new Prisma.Decimal(0),
    proposedOperatingExpenses: new Prisma.Decimal(0),
    netMovement: new Prisma.Decimal(0),
    unmapped: 0,
  });
}
