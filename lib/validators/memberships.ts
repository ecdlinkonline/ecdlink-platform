import { z } from "zod";

export const membershipStatusSchema = z.enum(["Pending", "Active", "Overdue", "Expired", "Cancelled"]);
export const membershipPaymentStatusSchema = z.enum(["Not Paid", "Partially Paid", "Paid", "Refunded", "Pending", "Overdue"]);

const dateString = z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date.");

export const membershipFiltersSchema = z.object({
  query: z.string().optional(),
  status: z.union([membershipStatusSchema, z.literal("All")]).optional(),
  paymentStatus: z.union([membershipPaymentStatusSchema, z.literal("All")]).optional(),
  region: z.string().optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional()
});

export const createMembershipSchema = z.object({
  centreId: z.string().min(1),
  membershipYear: z.coerce.number().int().min(2020).max(2100),
  startDate: dateString,
  expiryDate: dateString,
  renewalReminderDate: dateString,
  annualFee: z.coerce.number().positive().default(1250),
  notes: z.string().max(2000).optional()
});

export const updateMembershipSchema = z.object({
  startDate: dateString.optional(),
  expiryDate: dateString.optional(),
  renewalReminderDate: dateString.optional(),
  annualFee: z.coerce.number().positive().optional(),
  notes: z.string().max(2000).optional()
});

export const membershipPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().min(1).max(80),
  paymentReference: z.string().min(1).max(120),
  paymentDate: dateString,
  allowCredit: z.boolean().optional().default(false)
});

export const renewMembershipSchema = z.object({
  membershipYear: z.coerce.number().int().min(2020).max(2100).optional(),
  startDate: dateString.optional(),
  expiryDate: dateString.optional(),
  renewalReminderDate: dateString.optional(),
  notes: z.string().max(2000).optional()
});

export const cancelMembershipSchema = z.object({
  reason: z.string().min(3).max(1000)
});

export const invoiceMembershipSchema = z.object({
  dueDate: dateString.optional()
});

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
export type MembershipPaymentInput = z.infer<typeof membershipPaymentSchema>;
export type RenewMembershipInput = z.infer<typeof renewMembershipSchema>;
export type CancelMembershipInput = z.infer<typeof cancelMembershipSchema>;
