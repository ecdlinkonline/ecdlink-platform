import type { ProcurementCategory } from "@/lib/procurement/types";

export type SupplierStatus = "Pending" | "Approved" | "Suspended" | "Archived";
export type SupplierComplianceStatus = "Compliant" | "Expiring Soon" | "Missing" | "Under Review";
export type SupplierDeliveryCapability = "Local only" | "Provincial" | "Multi-province" | "National";
export type SupplierOrderStatus = "Pending" | "Packed" | "Out for Delivery" | "Delivered" | "Cancelled";
export type SupplierQuoteStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Comparison";
export type SupplierPaymentStatus = "Pending" | "Scheduled" | "Paid" | "Overdue";

export type SupplierProfile = {
  id: string;
  companyName: string;
  registrationNumber: string;
  contactPerson: string;
  phoneNumber: string;
  emailAddress: string;
  physicalAddress: string;
  areasServed: string[];
  productCategories: ProcurementCategory[];
  deliveryCapability: SupplierDeliveryCapability;
  bulkPricing: boolean;
  taxComplianceStatus: SupplierComplianceStatus;
  status: SupplierStatus;
  performanceScore: number;
  onTimeDeliveryRate: number;
  fulfilmentRate: number;
  averageQuoteResponseHours: number;
};

export type SupplierProduct = {
  id: string;
  supplierId: string;
  productName: string;
  category: ProcurementCategory;
  brand: string;
  packSize: string;
  unitPrice: number;
  stockAvailability: "In Stock" | "Low Stock" | "Out of Stock" | "Confirm Date";
  minimumOrderQuantity: number;
  imagePlaceholder: string;
  priceUpdatedAt: string;
};

export type SupplierOrder = {
  id: string;
  supplierId: string;
  month: string;
  status: SupplierOrderStatus;
  deliveryDate: string;
  totalValue: number;
  items: Array<{
    productName: string;
    category: ProcurementCategory;
    totalQuantity: number;
    centres: Array<{ centreName: string; quantity: number; packingNote: string }>;
  }>;
  deliveryNotes: string;
  proofOfDeliveryPlaceholder: string;
};

export type SupplierQuote = {
  id: string;
  supplierId: string;
  category: ProcurementCategory;
  value: number;
  status: SupplierQuoteStatus;
  submittedAt: string;
  validUntil: string;
  responseHours: number;
};

export type SupplierInvoice = {
  id: string;
  supplierId: string;
  orderId: string;
  amount: number;
  status: "Draft" | "Sent" | "Approved" | "Paid";
  paymentStatus: SupplierPaymentStatus;
  dueDate: string;
  paymentConfirmationPlaceholder: string;
};

export type SupplierFilters = {
  query?: string;
  category?: ProcurementCategory | "All";
  area?: string;
  status?: SupplierStatus | "All";
  compliance?: SupplierComplianceStatus | "All";
};

export type SupplierReport = {
  averagePerformanceScore: number;
  onTimeDeliveryRate: number;
  fulfilmentRate: number;
  averageQuoteResponseHours: number;
  topSuppliedCategories: Array<{ label: string; value: number }>;
  monthlySupplierOrderValue: Array<{ label: string; value: number }>;
};
