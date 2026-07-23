import type { CartItem, CentreOrder, ConsolidatedSupplierOrder, ProcurementCategory, ProcurementProduct } from "@/lib/procurement/types";

export const procurementCategories: ProcurementCategory[] = [
  "Maize Meal",
  "Cooking Oil",
  "Cereal",
  "Rice",
  "Pasta & Noodles",
  "Soya & Soup",
  "Tin Food",
  "Sugar",
  "Spreads, Jam & Peanut Butter",
  "Spices",
  "Soups",
  "Sauces",
  "Tea",
  "Milk",
  "Coffee",
  "Juice",
  "Water & Sparkling Water",
  "Cleaning Products, PPE & Equipment"
];

export const monthlyBudgetOptions = [2000, 3000, 5000, 8000, 10000];

const categoryProducts: Record<ProcurementCategory, string[]> = {
  "Maize Meal": ["Iwisa Maize Meal", "Ace Super Maize Meal", "White Star Maize Meal", "Impala Maize Meal", "Selati Maize Meal", "Bulk Samp"],
  "Cooking Oil": ["Sunfoil Cooking Oil", "Excella Oil", "Golden Fry Oil", "Canola Oil", "Vegetable Oil", "Bulk Frying Oil"],
  Cereal: ["Maltabella", "Jungle Oats", "Corn Flakes", "Instant Oats", "Breakfast Porridge", "Mabele Cereal"],
  Rice: ["Tastic Rice", "Spekko Rice", "Parboiled Rice", "Basmati Rice", "Bulk White Rice", "Brown Rice"],
  "Pasta & Noodles": ["Macaroni", "Spaghetti", "Penne Pasta", "Two Minute Noodles", "Vermicelli", "Pasta Screws"],
  "Soya & Soup": ["Soya Mince Curry", "Soya Mince Beef", "Soup Mix", "Lentil Soup Mix", "Split Peas", "Beans Soup Pack"],
  "Tin Food": ["Baked Beans", "Pilchards", "Tomato & Onion Mix", "Mixed Vegetables Tin", "Sweetcorn Tin", "Tinned Peas"],
  Sugar: ["White Sugar", "Brown Sugar", "Castor Sugar", "Bulk Sugar", "Sugar Sachets", "Icing Sugar"],
  "Spreads, Jam & Peanut Butter": ["Peanut Butter", "Apricot Jam", "Mixed Fruit Jam", "Margarine Spread", "Chocolate Spread", "Sandwich Spread"],
  Spices: ["Curry Powder", "Chicken Spice", "BBQ Spice", "Salt", "Black Pepper", "Mixed Herbs"],
  Soups: ["Brown Onion Soup", "Chicken Soup", "Vegetable Soup", "Tomato Soup", "Mushroom Soup", "Minestrone Soup"],
  Sauces: ["Tomato Sauce", "Chutney", "Mayonnaise", "Worcester Sauce", "Sweet Chilli Sauce", "Soy Sauce"],
  Tea: ["Rooibos Tea", "Five Roses Tea", "Joko Tea", "Tea Bags Bulk", "Herbal Tea", "Economy Tea"],
  Milk: ["Long Life Milk", "Powdered Milk", "Full Cream Milk", "Low Fat Milk", "Milk Sachets", "Evaporated Milk"],
  Coffee: ["Ricoffy", "Instant Coffee", "Filter Coffee", "Coffee Sachets", "Chicory Blend", "Bulk Coffee"],
  Juice: ["Orange Juice", "Apple Juice", "Fruit Nectar", "Concentrate Juice", "Mixed Fruit Juice", "Vitamin Juice"],
  "Water & Sparkling Water": ["Still Water", "Sparkling Water", "5L Water", "500ml Water", "Flavoured Water", "Bulk Water"],
  "Cleaning Products, PPE & Equipment": ["Dishwashing Liquid", "Bleach", "Disinfectant", "Refuse Bags", "Gloves", "Masks", "Mop", "Broom"]
};

const packSizes = ["1kg", "2kg", "5kg", "10kg", "6 pack", "12 pack", "Bulk pack"];
const suppliers = ["FreshStart Foods", "Ubuntu Supply", "CleanCare", "EduPack SA", "Khayelitsha Fresh", "ECDLink Wholesale"];

export const procurementProducts: ProcurementProduct[] = procurementCategories.flatMap((category, categoryIndex) =>
  categoryProducts[category].map((name, productIndex) => ({
    id: `${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${productIndex + 1}`,
    name,
    category,
    price: 35 + categoryIndex * 7 + productIndex * 13,
    packSize: packSizes[(categoryIndex + productIndex) % packSizes.length],
    supplierBrand: suppliers[(categoryIndex + productIndex) % suppliers.length],
    availability: productIndex % 9 === 0 ? "Low Stock" : productIndex % 13 === 0 ? "Out of Stock" : "Available"
  }))
);

export const defaultCartItems: CartItem[] = [
  { productId: "maize-meal-1", quantity: 8 },
  { productId: "cooking-oil-1", quantity: 4 },
  { productId: "rice-1", quantity: 6 },
  { productId: "tin-food-1", quantity: 12 },
  { productId: "milk-1", quantity: 6 }
];

export const centreOrders: CentreOrder[] = [
  {
    id: "order-001",
    orderNumber: "ECD-2026-07-001",
    centreId: "little-stars-ecd",
    centreName: "Little Stars ECD Centre",
    region: "Western Cape",
    month: "July 2026",
    budget: 8000,
    status: "Awaiting Approval",
    items: defaultCartItems,
    submittedAt: "2026-07-09",
    invoiceNumber: "INV-ECD-2026-001",
    deliveryStatus: "Pending",
    deliveryNotes: "Awaiting ECDLink approval."
  },
  {
    id: "order-002",
    orderNumber: "ECD-2026-07-002",
    centreId: "bright-steps-centre",
    centreName: "Bright Steps Centre",
    region: "Gauteng",
    month: "July 2026",
    budget: 10000,
    status: "Approved",
    items: defaultCartItems.map((item) => ({ ...item, quantity: item.quantity + 2 })),
    submittedAt: "2026-07-08",
    invoiceNumber: "INV-ECD-2026-002",
    deliveryStatus: "Packed",
    deliveryNotes: "Packed separately by centre."
  },
  {
    id: "order-003",
    orderNumber: "ECD-2026-07-003",
    centreId: "ubuntu-kids",
    centreName: "Ubuntu Kids",
    region: "KwaZulu-Natal",
    month: "July 2026",
    budget: 5000,
    status: "Delivered",
    items: defaultCartItems.slice(0, 4),
    submittedAt: "2026-07-07",
    invoiceNumber: "INV-ECD-2026-003",
    deliveryStatus: "Delivered",
    deliveryNotes: "Proof of delivery placeholder available."
  },
  {
    id: "order-004",
    orderNumber: "ECD-2026-07-004",
    centreId: "future-leaders-ecd",
    centreName: "Future Leaders ECD",
    region: "Gauteng",
    month: "July 2026",
    budget: 10000,
    status: "Packed",
    items: defaultCartItems.map((item) => ({ ...item, quantity: item.quantity + 4 })),
    submittedAt: "2026-07-07",
    invoiceNumber: "INV-ECD-2026-004",
    deliveryStatus: "Packed",
    deliveryNotes: "Delivery scheduled for Friday."
  }
];

export const consolidatedOrders: ConsolidatedSupplierOrder[] = [
  { id: "supplier-order-001", supplier: "FreshStart Foods", month: "July 2026", status: "Sent", centreOrderIds: ["order-001", "order-002", "order-003", "order-004"] },
  { id: "supplier-order-002", supplier: "Ubuntu Supply", month: "July 2026", status: "Packing", centreOrderIds: ["order-001", "order-004"] },
  { id: "supplier-order-003", supplier: "CleanCare", month: "July 2026", status: "Confirmed", centreOrderIds: ["order-002", "order-003"] }
];

export const deliveryStages = ["Pending", "Packed", "Out for Delivery", "Delivered"] as const;

export const procurementNotifications = [
  "Monthly ordering is open",
  "Order submitted",
  "Order approved",
  "Order packed",
  "Order delivered"
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

export function getProduct(productId: string) {
  const product = procurementProducts.find((item) => item.id === productId);
  if (!product) throw new Error(`Unknown product ${productId}`);
  return product;
}

export function calculateCart(items: CartItem[]) {
  const subtotal = items.reduce((sum, item) => sum + getProduct(item.productId).price * item.quantity, 0);
  const serviceFee = Math.round(subtotal * 0.035);
  return { subtotal, serviceFee, total: subtotal + serviceFee };
}
