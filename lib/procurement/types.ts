export type ProcurementCategory =
  | "Maize Meal"
  | "Cooking Oil"
  | "Cereal"
  | "Rice"
  | "Pasta & Noodles"
  | "Soya & Soup"
  | "Tin Food"
  | "Sugar"
  | "Spreads, Jam & Peanut Butter"
  | "Spices"
  | "Soups"
  | "Sauces"
  | "Tea"
  | "Milk"
  | "Coffee"
  | "Juice"
  | "Water & Sparkling Water"
  | "Cleaning Products, PPE & Equipment";

export type ProductAvailability = "Available" | "Low Stock" | "Out of Stock";
export type OrderStatus = "Draft" | "Submitted" | "Awaiting Approval" | "Approved" | "Rejected" | "Packed" | "Out for Delivery" | "Delivered" | "Cancelled";
export type DeliveryStatus = "Pending" | "Packed" | "Out for Delivery" | "Delivered" | "Cancelled";

export type ProcurementProduct = {
  id: string;
  sku?: string;
  name: string;
  category: ProcurementCategory;
  brand?: string;
  description?: string;
  price: number;
  packSize: string;
  unit?: string;
  vatApplicable?: boolean;
  supplierBrand: string;
  supplierId?: string;
  supplierProductCode?: string;
  barcode?: string;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
  active?: boolean;
  availability: ProductAvailability;
};

export type CartItem = {
  productId: string;
  quantity: number;
};

export type CentreOrder = {
  id: string;
  orderNumber: string;
  centreId: string;
  centreName: string;
  region: string;
  month: string;
  budget: number;
  currentSpend?: number;
  remainingBudget?: number;
  percentageUsed?: number;
  status: OrderStatus;
  items: CartItem[];
  submittedAt: string;
  invoiceNumber: string;
  deliveryStatus: DeliveryStatus;
  deliveryNotes: string;
};

export type ConsolidatedSupplierOrder = {
  id: string;
  supplier: string;
  month: string;
  status: "Draft" | "Sent" | "Confirmed" | "Packing" | "Delivered";
  centreOrderIds: string[];
};
