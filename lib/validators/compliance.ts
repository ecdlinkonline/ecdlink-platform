import { z } from "zod";

export const complianceDocumentStatusSchema = z.enum(["Missing", "Uploaded", "Expiring Soon", "Expired", "Rejected", "Archived", "Verified"]);
export const complianceVerificationStatusSchema = z.enum(["Pending Review", "Verified", "Rejected", "Requires Resubmission"]);
export const complianceScoreLightSchema = z.enum(["Green", "Amber", "Red"]);

const optionalDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date.").optional();

export const complianceRequirementSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(120).optional(),
  required: z.boolean().optional().default(true),
  requiresExpiryDate: z.boolean().optional().default(false),
  acceptedFileTypes: z.array(z.string()).optional().default(["application/pdf", "image/jpeg", "image/png"]),
  maxFileSize: z.coerce.number().int().positive().optional().default(10_000_000),
  active: z.boolean().optional().default(true),
  displayOrder: z.coerce.number().int().nonnegative().optional().default(0)
});

export const complianceDocumentUploadSchema = z.object({
  requirementId: z.string().min(1),
  documentNumber: z.string().max(120).optional(),
  issueDate: optionalDate,
  expiryDate: optionalDate,
  file: z.object({
    storageProvider: z.string().min(2).default("placeholder"),
    storageKey: z.string().min(2),
    originalFilename: z.string().min(1),
    mimeType: z.string().min(3),
    fileSize: z.coerce.number().int().positive(),
    checksum: z.string().optional()
  }),
  adminNotes: z.string().max(2000).optional()
});

export const complianceDocumentUpdateSchema = z.object({
  documentNumber: z.string().max(120).optional(),
  issueDate: optionalDate,
  expiryDate: optionalDate,
  adminNotes: z.string().max(2000).optional()
});

export const complianceVerifySchema = z.object({
  notes: z.string().max(2000).optional()
});

export const complianceRejectSchema = z.object({
  reason: z.string().min(3).max(2000)
});

export const complianceResubmissionSchema = z.object({
  reason: z.string().min(3).max(2000)
});

export type ComplianceDocumentUploadInput = z.infer<typeof complianceDocumentUploadSchema>;
