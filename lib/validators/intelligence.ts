import { z } from "zod";

export const intelligenceQuerySchema = z.object({
  queryText: z.string().min(2).max(2000),
  queryCategory: z.string().default("General"),
  queryIntent: z.string().optional(),
  metadata: z.unknown().optional()
});

export const insightPatchSchema = z.object({
  status: z.enum(["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "DISMISSED", "EXPIRED"]).optional()
});

export const recommendationPatchSchema = z.object({
  status: z.enum(["SUGGESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "DISMISSED"]).optional()
});

export const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  region: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});

export const centreHealthSchema = z.object({ centreId: z.string().optional() });
export const complianceGapSchema = z.object({ centreId: z.string().optional() });
export const procurementRecommendationSchema = z.object({ centreId: z.string().optional(), budget: z.coerce.number().positive().optional() });
export const fundingMatchSchema = z.object({ centreId: z.string().optional(), projectId: z.string().optional() });

export const proposalDraftSchema = z.object({
  centreId: z.string().optional(),
  projectId: z.string().optional(),
  fundingCallId: z.string().optional(),
  title: z.string().min(2).optional()
});

export const proposalDraftPatchSchema = z.object({
  title: z.string().min(2).optional(),
  executiveSummary: z.string().optional(),
  status: z.enum(["DRAFT", "REVIEWED", "ACCEPTED", "REJECTED", "CONVERTED"]).optional()
});

export const budgetDraftSchema = z.object({
  centreId: z.string().optional(),
  projectId: z.string().optional(),
  title: z.string().min(2).optional(),
  requestedAmount: z.coerce.number().nonnegative().optional()
});

export const budgetDraftPatchSchema = z.object({
  title: z.string().min(2).optional(),
  status: z.enum(["DRAFT", "REVIEWED", "ACCEPTED", "REJECTED", "CONVERTED"]).optional()
});

export const reportSchema = z.object({
  reportType: z.string().min(2),
  title: z.string().min(2).optional(),
  metadata: z.unknown().optional()
});
