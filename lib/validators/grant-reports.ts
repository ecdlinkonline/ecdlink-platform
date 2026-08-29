import { z } from "zod";
import { addGrantAmounts, grantReportBeneficiaryCategories, grantReportCertificationParties, grantReportRacialGroups, quarterlyExpenditureTotals, subtractGrantAmounts, sumGrantAmounts } from "@/lib/grant-reports/editor";

const optionalId = z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined));
const optionalDate = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.date().optional(),
);

export const grantReportFiltersSchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "RETURNED", "APPROVED", "ARCHIVED"]).optional(),
  type: z.enum(["INTERIM", "FINAL", "QUARTERLY_EXPENDITURE", "QUARTERLY_CASH_FLOW", "CUSTOM"]).optional(),
  centreId: optionalId,
  organisationId: optionalId,
});

export const createGrantAwardSchema = z.object({
  sourceType: z.enum(["FUNDING_APPLICATION", "SPONSORSHIP_COMMITMENT", "MANUAL"]),
  fundingApplicationId: optionalId,
  sponsorshipCommitmentId: optionalId,
  centreId: z.string().trim().min(1),
  fundingProjectId: z.string().trim().min(1),
  awardNumber: z.string().trim().min(2).max(100),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  awardedAmount: z.coerce.number().nonnegative(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("ZAR"),
  startDate: z.coerce.date(),
  endDate: optionalDate,
  signedAgreementFileAssetId: optionalId,
  agreementDate: optionalDate,
  signedByBothParties: z.coerce.boolean().default(false),
  organisationType: z.enum(["FUNDING_ORGANISATION", "DONOR_ORGANISATION"]),
  fundingOrganisationId: optionalId,
  donorOrganisationId: optionalId,
  canReview: z.coerce.boolean().default(true),
  canApprove: z.coerce.boolean().default(false),
}).superRefine((input, context) => {
  if (input.endDate && input.endDate < input.startDate) context.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date." });
  if (input.sourceType === "FUNDING_APPLICATION" && (!input.fundingApplicationId || input.sponsorshipCommitmentId)) context.addIssue({ code: "custom", path: ["fundingApplicationId"], message: "Select one approved funding application." });
  if (input.sourceType === "SPONSORSHIP_COMMITMENT" && (!input.sponsorshipCommitmentId || input.fundingApplicationId)) context.addIssue({ code: "custom", path: ["sponsorshipCommitmentId"], message: "Select one confirmed sponsorship commitment." });
  if (input.sourceType === "MANUAL" && (input.fundingApplicationId || input.sponsorshipCommitmentId)) context.addIssue({ code: "custom", path: ["sourceType"], message: "Manual awards cannot include a source record." });
  if (input.organisationType === "FUNDING_ORGANISATION" && (!input.fundingOrganisationId || input.donorOrganisationId)) context.addIssue({ code: "custom", path: ["fundingOrganisationId"], message: "Select one funding organisation." });
  if (input.organisationType === "DONOR_ORGANISATION" && (!input.donorOrganisationId || input.fundingOrganisationId)) context.addIssue({ code: "custom", path: ["donorOrganisationId"], message: "Select one donor organisation." });
});

export const createGrantReportingObligationSchema = z.object({
  grantAwardId: z.string().trim().min(1),
  grantTrancheId: optionalId,
  type: z.enum(["INTERIM", "FINAL", "QUARTERLY_EXPENDITURE", "QUARTERLY_CASH_FLOW", "CUSTOM"]),
  basis: z.enum(["QUARTER", "TRANCHE", "PERIOD", "FINAL", "CUSTOM"]),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  reportingPeriodStart: optionalDate,
  reportingPeriodEnd: optionalDate,
  financialYear: z.string().trim().max(20).optional(),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  dueAt: z.coerce.date(),
  requiresFunderApproval: z.coerce.boolean().default(true),
  requiresSuperAdminApproval: z.coerce.boolean().default(false),
}).superRefine((input, context) => {
  const standardBasis = input.type === "INTERIM" || input.type === "FINAL"
    ? "PERIOD"
    : input.type === "QUARTERLY_EXPENDITURE" || input.type === "QUARTERLY_CASH_FLOW"
      ? "QUARTER"
      : null;
  if (standardBasis && input.basis !== standardBasis) context.addIssue({ code: "custom", path: ["basis"], message: `${input.type} reports require the ${standardBasis} obligation basis.` });
  if (input.reportingPeriodStart && input.reportingPeriodEnd && input.reportingPeriodEnd < input.reportingPeriodStart) context.addIssue({ code: "custom", path: ["reportingPeriodEnd"], message: "Reporting period end must be on or after its start." });
  if (input.basis === "QUARTER" && (!input.financialYear || !input.quarter || !input.reportingPeriodStart || !input.reportingPeriodEnd)) context.addIssue({ code: "custom", path: ["basis"], message: "Quarter-based obligations require a financial year, quarter and reporting period." });
  if (input.basis === "TRANCHE" && !input.grantTrancheId) context.addIssue({ code: "custom", path: ["grantTrancheId"], message: "Tranche-based obligations require a tranche." });
  if (["PERIOD", "FINAL"].includes(input.basis) && (!input.reportingPeriodStart || !input.reportingPeriodEnd)) context.addIssue({ code: "custom", path: ["basis"], message: "Period and final obligations require reporting period dates." });
  if (input.basis !== "TRANCHE" && input.grantTrancheId) context.addIssue({ code: "custom", path: ["grantTrancheId"], message: "Only tranche-based obligations may select a tranche." });
  if (input.basis !== "QUARTER" && (input.financialYear || input.quarter)) context.addIssue({ code: "custom", path: ["financialYear"], message: "Financial year and quarter are only valid for quarter-based obligations." });
  if (!["QUARTER", "PERIOD", "FINAL"].includes(input.basis) && (input.reportingPeriodStart || input.reportingPeriodEnd)) context.addIssue({ code: "custom", path: ["reportingPeriodStart"], message: "Reporting period dates are not valid for this obligation basis." });
});

const reportRowId = z.string().trim().min(1).optional();
const narrative = z.string().trim().max(20_000).nullable().optional();
const nonNegativeCount = z.coerce.number().int().min(0).max(10_000_000);
const money = z.string().trim().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Enter a non-negative amount with no more than two decimal places.");

export const saveGrantReportGeneralSchema = z.object({
  section: z.literal("general"),
  data: z.object({
    reportingPeriodStart: z.string().date().nullable(),
    reportingPeriodEnd: z.string().date().nullable(),
    previousTrancheBalance: money.nullable(),
  }).superRefine((input, context) => {
    if (input.reportingPeriodStart && input.reportingPeriodEnd && input.reportingPeriodEnd < input.reportingPeriodStart) {
      context.addIssue({ code: "custom", path: ["reportingPeriodEnd"], message: "Reporting period end must be on or after its start." });
    }
  }),
});

export const saveGrantReportIndicatorsSchema = z.object({
  section: z.literal("objectives"),
  data: z.object({
    rows: z.array(z.object({
      id: reportRowId,
      objective: z.string().trim().min(1).max(2_000),
      deliverable: z.string().trim().max(2_000).nullable().optional(),
      achieved: z.string().trim().max(5_000).nullable().optional(),
      status: z.enum(["NOT_STARTED", "ON_TRACK", "AT_RISK", "DELAYED", "COMPLETED", "NOT_APPLICABLE"]),
      meansOfVerification: z.string().trim().max(5_000).nullable().optional(),
    })).max(100),
  }),
});

export const saveGrantReportBeneficiariesSchema = z.object({
  section: z.literal("beneficiaries"),
  data: z.object({
    beneficiaries: z.array(z.object({
      category: z.enum(grantReportBeneficiaryCategories),
      total: nonNegativeCount,
      male: nonNegativeCount,
      female: nonNegativeCount,
    })).length(grantReportBeneficiaryCategories.length),
    racialRows: z.array(z.object({
      racialGroup: z.enum(grantReportRacialGroups),
      children: nonNegativeCount,
      youth: nonNegativeCount,
      men: nonNegativeCount,
      women: nonNegativeCount,
      olderPersons: nonNegativeCount,
      peopleWithDisabilities: nonNegativeCount,
    })).length(grantReportRacialGroups.length),
  }).superRefine((input, context) => {
    if (new Set(input.beneficiaries.map((row) => row.category)).size !== grantReportBeneficiaryCategories.length) {
      context.addIssue({ code: "custom", path: ["beneficiaries"], message: "Each beneficiary category must appear exactly once." });
    }
    input.beneficiaries.forEach((row, index) => {
      if (row.total !== row.male + row.female) context.addIssue({ code: "custom", path: ["beneficiaries", index, "total"], message: "Total must equal the male and female counts." });
    });
    if (new Set(input.racialRows.map((row) => row.racialGroup)).size !== grantReportRacialGroups.length) {
      context.addIssue({ code: "custom", path: ["racialRows"], message: "Each racial-profile group must appear exactly once." });
    }
  }),
});

export const saveGrantReportSustainabilitySchema = z.object({
  section: z.literal("sustainability"),
  data: z.object({
    challenges: narrative,
    organisationalChanges: narrative,
    communityChanges: narrative,
    rows: z.array(z.object({ id: reportRowId, plan: z.string().trim().min(1).max(10_000), progressToDate: z.string().trim().min(1).max(10_000) })).max(100),
  }),
});

export const saveGrantReportFinancialSchema = z.object({
  section: z.literal("financial"),
  data: z.object({
    fundingReceivedTotal: money,
    previousTrancheBalance: money.nullable(),
    quarterlyExpenditureTotal: money,
    rows: z.array(z.object({
      id: reportRowId,
      categoryName: z.string().trim().min(1).max(500),
      description: z.string().trim().max(2_000).nullable().optional(),
      approvedBudget: money.nullable(),
      quarterlyActual: money.nullable(),
    })).max(250),
  }),
});

export const saveQuarterlyExpenditureGeneralSchema = z.object({
  section: z.literal("quarterly_general"),
  data: z.object({
    financialYear: z.string().trim().min(1).max(20),
    quarter: z.coerce.number().int().min(1).max(4),
    reportingPeriodStart: z.string().date(),
    reportingPeriodEnd: z.string().date(),
  }).superRefine((input, context) => {
    if (input.reportingPeriodEnd < input.reportingPeriodStart) context.addIssue({ code: "custom", path: ["reportingPeriodEnd"], message: "Reporting period end must be on or after its start." });
  }),
});

const quarterlyIncomeRow = z.object({
  id: reportRowId,
  lineType: z.enum(["FUNDING_RECEIVED", "OTHER_INCOME"]),
  categoryName: z.string().trim().min(1).max(500),
  amount: money.nullable(),
});

export const saveQuarterlyIncomeSchema = z.object({
  section: z.literal("quarterly_income"),
  data: z.object({
    rows: z.array(quarterlyIncomeRow).max(100),
    totalIncome: money,
  }).superRefine((input, context) => {
    const expected = sumGrantAmounts(input.rows.map((row) => row.amount));
    const supplied = sumGrantAmounts([input.totalIncome]);
    if (expected === null || expected !== supplied) context.addIssue({ code: "custom", path: ["totalIncome"], message: "Total income must equal the sum of the income lines." });
  }),
});

const quarterlyExpenditureRow = z.object({
  id: reportRowId,
  categoryName: z.string().trim().min(1).max(500),
  costingFrameworkPercentage: money.nullable(),
  quarterlyBudget: money.nullable(),
  fundingSourceActual: money.nullable(),
  otherSourceActual: money.nullable(),
  quarterlyActual: money,
}).superRefine((row, context) => {
  if (row.costingFrameworkPercentage && Number(row.costingFrameworkPercentage) > 100) context.addIssue({ code: "custom", path: ["costingFrameworkPercentage"], message: "Costing Framework percentage must be between 0 and 100." });
  const expected = addGrantAmounts(row.fundingSourceActual, row.otherSourceActual);
  const supplied = sumGrantAmounts([row.quarterlyActual]);
  if (expected === null || expected !== supplied) context.addIssue({ code: "custom", path: ["quarterlyActual"], message: "Total expenditure must equal funding-source plus other-source expenditure." });
});

export const saveQuarterlyExpenditureSchema = z.object({
  section: z.literal("quarterly_expenditure"),
  data: z.object({
    rows: z.array(quarterlyExpenditureRow).max(250),
    totalAllocatedBudget: money,
    totalFundingSourceExpenditure: money,
    totalOtherSourceExpenditure: money,
    totalExpenditure: money,
    surplusDeficit: z.string().trim().regex(/^-?\d{1,12}(?:\.\d{1,2})?$/, "Enter a valid surplus or deficit with no more than two decimal places."),
    totalIncome: money,
  }).superRefine((input, context) => {
    const totals = quarterlyExpenditureTotals(input.rows);
    const comparisons = [
      ["totalAllocatedBudget", totals.totalAllocatedBudget],
      ["totalFundingSourceExpenditure", totals.totalFundingSourceExpenditure],
      ["totalOtherSourceExpenditure", totals.totalOtherSourceExpenditure],
      ["totalExpenditure", totals.totalExpenditure],
    ] as const;
    for (const [field, expected] of comparisons) {
      if (expected === null || expected !== sumGrantAmounts([input[field]])) context.addIssue({ code: "custom", path: [field], message: "The supplied total does not match the expenditure lines." });
    }
    const expectedSurplus = totals.totalExpenditure === null ? null : subtractGrantAmounts(input.totalIncome, totals.totalExpenditure);
    if (expectedSurplus === null || expectedSurplus !== normalizeSignedMoney(input.surplusDeficit)) context.addIssue({ code: "custom", path: ["surplusDeficit"], message: "Surplus or deficit must equal total income minus total expenditure." });
  }),
});

function normalizeSignedMoney(value: string) {
  const negative = value.startsWith("-");
  const normalized = sumGrantAmounts([negative ? value.slice(1) : value]);
  return normalized === null ? null : negative && normalized !== "0.00" ? `-${normalized}` : normalized;
}

export const saveQuarterlyBankReconciliationSchema = z.object({
  section: z.literal("bank_reconciliation"),
  data: z.object({
    openingBankBalance: money.nullable(),
    closingBankBalance: money.nullable(),
  }),
});

export const saveGrantReportCertificationsSchema = z.object({
  section: z.literal("certification"),
  data: z.object({
    rows: z.array(z.object({
      party: z.enum(grantReportCertificationParties),
      nameSnapshot: z.string().trim().min(1).max(200),
      designationSnapshot: z.string().trim().min(1).max(200),
      certificationDate: z.string().date().nullable(),
      digitallyConfirmed: z.boolean(),
    }).superRefine((row, context) => {
      if (row.digitallyConfirmed && !row.certificationDate) context.addIssue({ code: "custom", path: ["certificationDate"], message: "A certification date is required for digital confirmation." });
    })).length(grantReportCertificationParties.length),
  }).superRefine((input, context) => {
    if (new Set(input.rows.map((row) => row.party)).size !== grantReportCertificationParties.length) {
      context.addIssue({ code: "custom", path: ["rows"], message: "Compiler and approver certification records are both required." });
    }
  }),
});

export const saveGrantReportSectionSchema = z.discriminatedUnion("section", [
  saveGrantReportGeneralSchema,
  saveGrantReportIndicatorsSchema,
  saveGrantReportBeneficiariesSchema,
  saveGrantReportSustainabilitySchema,
  saveGrantReportFinancialSchema,
  saveQuarterlyExpenditureGeneralSchema,
  saveQuarterlyIncomeSchema,
  saveQuarterlyExpenditureSchema,
  saveQuarterlyBankReconciliationSchema,
  saveGrantReportCertificationsSchema,
]);

export const uploadGrantReportDocumentSchema = z.object({
  documentType: z.enum(["INVOICE", "BANK_STATEMENT", "PROOF_OF_PAYMENT", "RECEIPT", "PROCUREMENT_EVIDENCE", "INDICATOR_EVIDENCE", "BENEFICIARY_EVIDENCE", "SIGNED_REPORT", "AUDITED_FINANCIAL_STATEMENTS", "OTHER"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).optional(),
  indicatorId: optionalId,
});

export type CreateGrantAwardInput = z.infer<typeof createGrantAwardSchema>;
export type CreateGrantReportingObligationInput = z.infer<typeof createGrantReportingObligationSchema>;
export type GrantReportFiltersInput = z.infer<typeof grantReportFiltersSchema>;
export type SaveGrantReportSectionInput = z.infer<typeof saveGrantReportSectionSchema>;
export type UploadGrantReportDocumentInput = z.infer<typeof uploadGrantReportDocumentSchema>;
