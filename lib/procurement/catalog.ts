import type { CartItem, ProcurementProduct } from "@/lib/procurement/types";

export const procurementCategories = [
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
] as const;

export const monthlyBudgetOptions = [2000, 3000, 5000, 8000, 10000];
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

export function getProductFromList(products: ProcurementProduct[], productId: string) {
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error(`Unknown product ${productId}`);
  return product;
}

export function calculateCart(items: CartItem[], products: ProcurementProduct[]) {
  const subtotal = items.reduce((sum, item) => sum + getProductFromList(products, item.productId).price * item.quantity, 0);
  const serviceFee = Math.round(subtotal * 0.035);
  return { subtotal, serviceFee, total: subtotal + serviceFee };
}

export function budgetSnapshot(budget: number, spend: number) {
  return {
    currentSpend: spend,
    remainingBudget: budget - spend,
    percentageUsed: budget > 0 ? Math.round((spend / budget) * 100) : 0
  };
}
