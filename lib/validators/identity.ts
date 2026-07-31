import { z } from "zod";

export const userRoleSchema = z.enum(["SUPER_ADMIN", "ECDLINK_STAFF", "ECD_CENTRE", "SUPPLIER", "DONOR", "FUNDING_ORGANISATION", "SYSTEM"]);
export const userStatusSchema = z.enum(["ACTIVE", "INVITED", "SUSPENDED", "ARCHIVED"]);
export const centreUserRoleSchema = z.enum(["PRINCIPAL", "OWNER", "ADMINISTRATOR", "PRACTITIONER", "FINANCE", "VOLUNTEER", "READ_ONLY"]);

export const userQuerySchema = z.object({
  query: z.string().optional(),
  role: z.union([userRoleSchema, z.literal("All")]).optional(),
  status: z.union([userStatusSchema, z.literal("All")]).optional()
});

export const changeUserRoleSchema = z.object({
  role: userRoleSchema
});

export const changeUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"])
});

export const assignCentreUserSchema = z.object({
  userId: z.string().min(1),
  centreId: z.string().min(1),
  role: centreUserRoleSchema,
  permissions: z.array(z.string()).optional().default([]),
  isPrimary: z.boolean().optional().default(false),
  title: z.string().max(120).optional()
});

export const invitationCreateSchema = z.object({
  email: z.string().email(),
  invitedRole: userRoleSchema,
  centreId: z.string().optional(),
  centreRole: centreUserRoleSchema.optional(),
  permissions: z.array(z.string()).optional().default([]),
  expiresInDays: z.coerce.number().int().min(1).max(90).optional().default(14)
});

export const invitationAcceptSchema = z.object({
  token: z.string().min(24)
});

export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;
