import { z } from "zod";

export const partnerOrganisationSchema = z.object({
  organisationName: z.string().min(2),
  organisationType: z.string().min(2),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  focusAreas: z.array(z.string()).default([]),
  preferredRegions: z.array(z.string()).default([]),
  annualSupportBudget: z.coerce.number().nonnegative().optional()
});

export const partnerDecisionSchema = z.object({ reason: z.string().optional() });

export const partnerUserSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "ADMINISTRATOR", "PROGRAMME_MANAGER", "FINANCE", "MONITORING_EVALUATION", "VIEWER"]).default("VIEWER"),
  permissions: z.array(z.string()).default([]),
  isPrimary: z.boolean().optional()
});

export const partnershipRequestSchema = z.object({
  centreId: z.string().optional(),
  impactProjectId: z.string().optional(),
  requestType: z.string().min(2),
  message: z.string().optional(),
  proposedSupportType: z.string().optional(),
  proposedAmount: z.coerce.number().nonnegative().optional(),
  proposedItems: z.unknown().optional(),
  preferredMeetingDate: z.coerce.date().optional()
});

export const requestStatusSchema = z.object({ status: z.string().min(2), notes: z.string().optional() });

export const commitmentSchema = z.object({
  partnershipRequestId: z.string().optional(),
  centreId: z.string().min(1),
  impactProjectId: z.string().optional(),
  commitmentType: z.string().min(2),
  committedAmount: z.coerce.number().nonnegative().optional(),
  committedItems: z.unknown().optional(),
  committedServices: z.unknown().optional(),
  expectedFulfilmentDate: z.coerce.date().optional(),
  notes: z.string().optional()
});

export const fulfilmentSchema = z.object({
  fulfilledDate: z.coerce.date().optional(),
  status: z.string().optional(),
  notes: z.string().optional()
});

export const projectUpdateSchema = z.object({
  impactProjectId: z.string().min(1),
  title: z.string().min(2),
  summary: z.string().min(2),
  fullUpdate: z.string().optional(),
  progressPercentage: z.coerce.number().int().min(0).max(100).default(0),
  beneficiariesReached: z.coerce.number().int().nonnegative().optional(),
  milestoneStatus: z.string().optional(),
  visibility: z.string().optional()
});

export const impactReportSchema = z.object({
  centreId: z.string().optional(),
  impactProjectId: z.string().optional(),
  donorOrganisationId: z.string().optional(),
  title: z.string().min(2),
  reportType: z.string().optional(),
  summary: z.string().optional(),
  childrenReached: z.coerce.number().int().nonnegative().optional(),
  staffSupported: z.coerce.number().int().nonnegative().optional(),
  amountAllocated: z.coerce.number().nonnegative().optional(),
  amountUsed: z.coerce.number().nonnegative().optional()
});

export const messageSchema = z.object({
  subject: z.string().min(2).optional(),
  body: z.string().min(1),
  centreId: z.string().optional(),
  partnershipRequestId: z.string().optional()
});
