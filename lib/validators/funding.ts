import { z } from "zod";

export const fundingStatusSchema = z.enum(["Draft", "In Progress", "Ready", "Submitted", "Approved", "Rejected"]);

export const fundingFiltersSchema = z.object({
  query: z.string().optional(),
  region: z.string().optional(),
  status: z.union([fundingStatusSchema, z.literal("All")]).optional(),
  funderType: z.string().optional(),
  readinessBand: z.enum(["All", "80+", "50-79", "Below 50"]).optional()
});

export const createFundingCallSchema = z.object({
  title: z.string().min(2),
  type: z.string().min(2),
  description: z.string().optional(),
  minimumAmount: z.coerce.number().nonnegative().optional(),
  maximumAmount: z.coerce.number().nonnegative().optional(),
  closesAt: z.coerce.date().optional(),
  requiredDocuments: z.array(z.string()).optional(),
  focusAreas: z.array(z.string()).optional(),
  eligibleRegions: z.array(z.string()).optional()
});

export const updateFundingCallSchema = createFundingCallSchema.partial().extend({
  status: z.string().optional(),
  featured: z.boolean().optional()
});

export const createFundingProjectSchema = z.object({
  title: z.string().min(2),
  opportunityType: z.string().min(2).optional(),
  funderType: z.string().min(2).optional(),
  objective: z.string().optional(),
  requestedAmount: z.coerce.number().positive(),
  beneficiaries: z.coerce.number().int().positive().optional()
});

export const updateFundingProposalSchema = z.object({
  title: z.string().min(2).optional(),
  executiveSummary: z.string().optional(),
  problemStatement: z.string().optional(),
  projectPlan: z.string().optional(),
  impactStatement: z.string().optional(),
  status: fundingStatusSchema.optional()
});

export const createBudgetSchema = z.object({
  title: z.string().min(2),
  requestedAmount: z.coerce.number().nonnegative(),
  coFundingAmount: z.coerce.number().nonnegative().optional(),
  items: z.array(z.object({
    label: z.string().min(2),
    category: z.string().optional(),
    quantity: z.coerce.number().int().positive(),
    unitCost: z.coerce.number().nonnegative(),
    justification: z.string().optional()
  })).default([])
});

export const createBeneficiaryListSchema = z.object({
  name: z.string().min(2),
  count: z.coerce.number().int().positive(),
  beneficiaryType: z.string().optional(),
  reportingPeriod: z.string().optional(),
  boysCount: z.coerce.number().int().nonnegative().optional(),
  girlsCount: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().optional()
});

export const createFundingApplicationSchema = z.object({
  projectId: z.string().min(1),
  fundingCallId: z.string().min(1).optional(),
  requestedAmount: z.coerce.number().positive(),
  submissionMethod: z.string().optional(),
  externalReference: z.string().optional()
});

export const applicationDecisionSchema = z.object({
  status: z.enum(["Approved", "Rejected", "Submitted", "In Progress"]),
  approvedAmount: z.coerce.number().nonnegative().optional(),
  rejectionReason: z.string().optional(),
  notes: z.string().optional()
});

export const createAssessmentSchema = z.object({
  fundingApplicationId: z.string().min(1).optional(),
  fundingCallId: z.string().min(1),
  eligibilityScore: z.coerce.number().int().min(0).max(100).optional(),
  complianceScore: z.coerce.number().int().min(0).max(100).optional(),
  projectQualityScore: z.coerce.number().int().min(0).max(100).optional(),
  budgetScore: z.coerce.number().int().min(0).max(100).optional(),
  impactScore: z.coerce.number().int().min(0).max(100).optional(),
  recommendation: z.string().optional(),
  notes: z.string().optional()
});
