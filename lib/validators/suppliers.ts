import { z } from "zod";

export const supplierFiltersSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  area: z.string().optional(),
  status: z.string().optional(),
  compliance: z.string().optional()
});

export const createSupplierSchema = z.object({
  companyName: z.string().min(2),
  registrationNumber: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  physicalAddress: z.string().optional(),
  areasServed: z.array(z.string()).default([])
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  vatNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  alternativePhone: z.string().optional(),
  website: z.string().optional(),
  suburb: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  deliveryCapability: z.string().optional(),
  bulkPricingCapability: z.boolean().optional(),
  minimumOrderValue: z.coerce.number().nonnegative().optional(),
  standardLeadTimeDays: z.coerce.number().int().nonnegative().optional()
});

export const supplierDecisionSchema = z.object({
  reason: z.string().optional()
});

export const createSupplierUserSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "ADMINISTRATOR", "SALES", "FINANCE", "LOGISTICS", "CATALOGUE_MANAGER", "READ_ONLY"]).default("READ_ONLY"),
  permissions: z.array(z.string()).default([]),
  isPrimary: z.boolean().optional()
});

export const supplierDocumentSchema = z.object({
  documentType: z.string().min(2),
  documentNumber: z.string().optional(),
  issueDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  fileId: z.string().optional()
});

export const verifySupplierDocumentSchema = z.object({
  notes: z.string().optional()
});

export const rejectSupplierDocumentSchema = z.object({
  reason: z.string().min(2)
});

export const supplierProductSchema = z.object({
  productId: z.string().min(1),
  supplierProductCode: z.string().optional(),
  supplierProductName: z.string().optional(),
  unitPrice: z.coerce.number().nonnegative(),
  stockStatus: z.string().optional(),
  availableQuantity: z.coerce.number().int().nonnegative().optional(),
  minimumOrderQuantity: z.coerce.number().int().positive().optional(),
  leadTimeDays: z.coerce.number().int().nonnegative().optional()
});

export const updateSupplierProductSchema = supplierProductSchema.partial().extend({
  reason: z.string().optional(),
  active: z.boolean().optional()
});

export const quotationSchema = z.object({
  supplierId: z.string().optional(),
  procurementCycleId: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().optional(),
    productNameSnapshot: z.string().min(1),
    packSizeSnapshot: z.string().optional(),
    quantity: z.coerce.number().int().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    availability: z.string().optional(),
    leadTimeDays: z.coerce.number().int().nonnegative().optional(),
    notes: z.string().optional()
  })).default([])
});

export const invoiceSchema = z.object({
  supplierId: z.string().optional(),
  supplierOrderId: z.string().optional(),
  externalInvoiceReference: z.string().optional(),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  subtotal: z.coerce.number().nonnegative(),
  vatAmount: z.coerce.number().nonnegative().default(0),
  deliveryFee: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional()
});

export const supplierPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentDate: z.coerce.date(),
  paymentMethod: z.string().optional(),
  paymentReference: z.string().optional(),
  proofOfPaymentFileAssetId: z.string().optional(),
  notes: z.string().optional()
});

export const deliveryUpdateSchema = z.object({
  status: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  dispatchedAt: z.coerce.date().optional(),
  deliveredAt: z.coerce.date().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  vehicleRegistration: z.string().optional(),
  deliveryNotes: z.string().optional(),
  receivedByName: z.string().optional(),
  failureReason: z.string().optional()
});
