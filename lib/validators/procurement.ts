import { z } from "zod";

export const procurementOrderStatusSchema = z.enum(["Draft", "Submitted", "Awaiting Approval", "Approved", "Rejected", "Packed", "Out for Delivery", "Delivered", "Cancelled"]);
export const procurementCycleStatusSchema = z.enum(["Draft", "Open", "Closed", "Processing", "Delivered", "Archived"]);

export const procurementOrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive()
});

export const createProcurementOrderSchema = z.object({
  budget: z.coerce.number().positive(),
  items: z.array(procurementOrderItemSchema).min(1),
  overrideBudget: z.boolean().optional().default(false)
});

export const procurementOrderFiltersSchema = z.object({
  query: z.string().optional(),
  status: z.union([procurementOrderStatusSchema, z.literal("All")]).optional(),
  region: z.string().optional(),
  month: z.string().optional(),
  supplier: z.string().optional()
});

export const openProcurementCycleSchema = z.object({
  month: z.string().min(3),
  year: z.coerce.number().int().min(2020).max(2100),
  opensAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid opening date."),
  closesAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid closing date."),
  deliveryWindowStart: z.string().optional(),
  deliveryWindowEnd: z.string().optional()
});

export const reviewProcurementOrderSchema = z.object({
  notes: z.string().max(2000).optional()
});

export type CreateProcurementOrderInput = z.infer<typeof createProcurementOrderSchema>;
export type OpenProcurementCycleInput = z.infer<typeof openProcurementCycleSchema>;
