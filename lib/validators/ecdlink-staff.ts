import { z } from "zod";

export const staffDepartmentSchema = z.enum([
  "OPERATIONS",
  "CENTRE_SUPPORT",
  "COMPLIANCE",
  "FAMILY_SUPPORT",
  "PROCUREMENT",
  "EVENTS",
  "FUNDING",
  "TRAINING",
  "FINANCE",
  "MONITORING_AND_EVALUATION",
  "MANAGEMENT"
]);

export const staffEmploymentStatusSchema = z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]);

export const staffProfileCreateSchema = z.object({
  userId: z.string().min(1),
  employeeNumber: z.string().min(2).max(80),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  jobTitle: z.string().min(1).max(160),
  department: staffDepartmentSchema,
  employmentStatus: staffEmploymentStatusSchema.optional().default("ACTIVE"),
  managerId: z.string().optional(),
  phoneNumber: z.string().max(40).optional(),
  workEmail: z.string().email(),
  startDate: z.coerce.date().optional(),
  profilePhoto: z.string().url().optional(),
  isActive: z.boolean().optional().default(true)
});

export const staffProfileUpdateSchema = staffProfileCreateSchema.omit({ userId: true }).partial();

export const staffCentreAssignmentCreateSchema = z.object({
  centreId: z.string().min(1),
  assignmentRole: z.string().min(1).max(120),
  assignedBy: z.string().optional(),
  isPrimary: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  notes: z.string().max(1000).optional()
});

export const staffCentreAssignmentUpdateSchema = z.object({
  assignmentRole: z.string().min(1).max(120).optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional()
});
