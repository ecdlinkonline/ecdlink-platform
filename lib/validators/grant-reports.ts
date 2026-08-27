import { z } from "zod";

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
  if (input.reportingPeriodStart && input.reportingPeriodEnd && input.reportingPeriodEnd < input.reportingPeriodStart) context.addIssue({ code: "custom", path: ["reportingPeriodEnd"], message: "Reporting period end must be on or after its start." });
  if (input.basis === "QUARTER" && (!input.financialYear || !input.quarter || !input.reportingPeriodStart || !input.reportingPeriodEnd)) context.addIssue({ code: "custom", path: ["basis"], message: "Quarter-based obligations require a financial year, quarter and reporting period." });
  if (input.basis === "TRANCHE" && !input.grantTrancheId) context.addIssue({ code: "custom", path: ["grantTrancheId"], message: "Tranche-based obligations require a tranche." });
  if (["PERIOD", "FINAL"].includes(input.basis) && (!input.reportingPeriodStart || !input.reportingPeriodEnd)) context.addIssue({ code: "custom", path: ["basis"], message: "Period and final obligations require reporting period dates." });
  if (input.basis !== "TRANCHE" && input.grantTrancheId) context.addIssue({ code: "custom", path: ["grantTrancheId"], message: "Only tranche-based obligations may select a tranche." });
});

export type CreateGrantAwardInput = z.infer<typeof createGrantAwardSchema>;
export type CreateGrantReportingObligationInput = z.infer<typeof createGrantReportingObligationSchema>;
export type GrantReportFiltersInput = z.infer<typeof grantReportFiltersSchema>;
