export function formatSupplierCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

export function supplierStatusForDisplay(status: string) {
  if (status === "Under Review") return "Pending";
  if (status === "Rejected") return "Suspended";
  return status;
}

export function supplierTaxStatusForDisplay(status: string | null | undefined) {
  if (!status || status === "Unknown" || status === "Pending Verification") return "Under Review";
  if (status === "Expired" || status === "Rejected") return "Missing";
  return status;
}

export function stockStatusForDisplay(status: string | null | undefined) {
  if (status === "LOW_STOCK") return "Low Stock";
  if (status === "OUT_OF_STOCK") return "Out of Stock";
  if (status === "BACK_ORDER") return "Confirm Date";
  if (status === "DISCONTINUED") return "Out of Stock";
  return "In Stock";
}

export function stockStatusToDb(status: string) {
  if (status === "Low Stock") return "LOW_STOCK";
  if (status === "Out of Stock") return "OUT_OF_STOCK";
  if (status === "Confirm Date" || status === "Back Order") return "BACK_ORDER";
  if (status === "Discontinued") return "DISCONTINUED";
  return "AVAILABLE";
}

export function deliveryCapabilityForDisplay(value: string | null | undefined) {
  if (!value) return "Provincial";
  return value;
}

export function performanceBand(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "High Risk";
}

export function onboardingPercentage(checklist: Record<string, boolean>) {
  const values = Object.values(checklist);
  return values.length ? Math.round((values.filter(Boolean).length / values.length) * 100) : 0;
}
