import { procurementCategories, procurementProducts } from "@/lib/procurement/data";
import type { ProcurementCategory } from "@/lib/procurement/types";
import type { SupplierInvoice, SupplierOrder, SupplierProduct, SupplierProfile, SupplierQuote } from "@/lib/supplier/types";

const supplierSeed = [
  ["freshstart-foods", "FreshStart Foods", "Western Cape", "Gauteng"],
  ["ubuntu-supply", "Ubuntu Supply", "Gauteng", "KwaZulu-Natal"],
  ["cleancare", "CleanCare", "Western Cape", "Gauteng"],
  ["edupack-sa", "EduPack SA", "Gauteng", "Western Cape"],
  ["khayelitsha-fresh", "Khayelitsha Fresh", "Western Cape", "KwaZulu-Natal"],
  ["ecdlink-wholesale", "ECDLink Wholesale", "Western Cape", "Gauteng"],
  ["masakhane-distributors", "Masakhane Distributors", "Gauteng", "KwaZulu-Natal"],
  ["little-learners-supply", "Little Learners Supply", "Western Cape", "Gauteng"],
  ["township-bulk-foods", "Township Bulk Foods", "KwaZulu-Natal", "Gauteng"],
  ["greenline-cleaning", "Greenline Cleaning", "Western Cape", "KwaZulu-Natal"]
] as const;

export const supplierProfiles: SupplierProfile[] = supplierSeed.map(([id, name, areaOne, areaTwo], index) => {
  const categories = procurementCategories.slice(index % 5, (index % 5) + 6) as ProcurementCategory[];
  if (index === 2 || index === 9) categories.push("Cleaning Products, PPE & Equipment");
  return {
    id,
    companyName: name,
    registrationNumber: `REG-202${index}-${4400 + index}`,
    contactPerson: ["Anele Jacobs", "Sipho Maseko", "Priya Naidoo", "Mpho Dlamini", "Zanele Gumede"][index % 5],
    phoneNumber: `+27 7${index} 555 ${2200 + index}`,
    emailAddress: `orders@${id}.co.za`,
    physicalAddress: `${18 + index} Supplier Park, ${areaOne}`,
    areasServed: [areaOne, areaTwo],
    productCategories: Array.from(new Set(categories)),
    deliveryCapability: index % 4 === 0 ? "National" : index % 3 === 0 ? "Multi-province" : "Provincial",
    bulkPricing: index % 2 === 0,
    taxComplianceStatus: index % 6 === 0 ? "Expiring Soon" : index % 7 === 0 ? "Under Review" : "Compliant",
    status: index === 0 || index === 1 || index === 2 || index > 4 ? "Approved" : index === 3 ? "Pending" : "Suspended",
    performanceScore: 91 - index * 3,
    onTimeDeliveryRate: 96 - index * 4,
    fulfilmentRate: 94 - index * 3,
    averageQuoteResponseHours: 8 + index * 2
  };
});

export const supplierProducts: SupplierProduct[] = supplierProfiles.flatMap((supplier, supplierIndex) => {
  const products = procurementProducts.filter((product) => supplier.productCategories.includes(product.category)).slice(0, 12);
  return products.map((product, index) => ({
    id: `${supplier.id}-${product.id}`,
    supplierId: supplier.id,
    productName: product.name,
    category: product.category,
    brand: product.supplierBrand,
    packSize: product.packSize,
    unitPrice: product.price + supplierIndex * 4,
    stockAvailability: index % 7 === 0 ? "Low Stock" : index % 11 === 0 ? "Confirm Date" : "In Stock",
    minimumOrderQuantity: 5 + (index % 6) * 5,
    imagePlaceholder: "Product image placeholder",
    priceUpdatedAt: `2026-07-${String((index % 8) + 1).padStart(2, "0")}`
  }));
});

export const supplierOrders: SupplierOrder[] = supplierProfiles.slice(0, 6).map((supplier, index) => {
  const products = supplierProducts.filter((product) => product.supplierId === supplier.id).slice(0, 5);
  return {
    id: `SUP-ORD-2026-07-${String(index + 1).padStart(3, "0")}`,
    supplierId: supplier.id,
    month: "July 2026",
    status: index % 4 === 0 ? "Pending" : index % 4 === 1 ? "Packed" : index % 4 === 2 ? "Out for Delivery" : "Delivered",
    deliveryDate: `2026-07-${18 + index}`,
    totalValue: products.reduce((sum, product) => sum + product.unitPrice * (20 + index * 4), 0),
    items: products.map((product, productIndex) => ({
      productName: product.productName,
      category: product.category,
      totalQuantity: 24 + productIndex * 8 + index,
      centres: ["Little Stars ECD Centre", "Bright Steps Centre", "Ubuntu Kids", "Future Leaders ECD"].map((centreName, centreIndex) => ({
        centreName,
        quantity: 4 + centreIndex + productIndex,
        packingNote: `Pack separately for ${centreName}.`
      }))
    })),
    deliveryNotes: "Deliver packed centre parcels to ECDLink coordination point.",
    proofOfDeliveryPlaceholder: "POD upload placeholder"
  };
});

export const supplierQuotes: SupplierQuote[] = supplierProfiles.slice(0, 8).map((supplier, index) => ({
  id: `SUP-Q-2026-${String(index + 1).padStart(3, "0")}`,
  supplierId: supplier.id,
  category: supplier.productCategories[0],
  value: 18000 + index * 6200,
  status: index % 4 === 0 ? "Submitted" : index % 4 === 1 ? "Approved" : index % 4 === 2 ? "Comparison" : "Draft",
  submittedAt: `2026-07-0${(index % 7) + 1}`,
  validUntil: `2026-07-${20 + index}`,
  responseHours: 6 + index * 3
}));

export const supplierInvoices: SupplierInvoice[] = supplierOrders.map((order, index) => ({
  id: `SUP-INV-2026-07-${String(index + 1).padStart(3, "0")}`,
  supplierId: order.supplierId,
  orderId: order.id,
  amount: order.totalValue,
  status: order.status === "Delivered" ? "Approved" : index % 2 === 0 ? "Draft" : "Sent",
  paymentStatus: order.status === "Delivered" ? "Scheduled" : index % 2 === 0 ? "Pending" : "Overdue",
  dueDate: `2026-08-0${(index % 7) + 1}`,
  paymentConfirmationPlaceholder: "Payment confirmation placeholder"
}));

export function formatSupplierCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}
