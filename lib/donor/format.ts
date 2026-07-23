export function formatDonorCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

export function partnerStatusForDisplay(status: string) {
  if (status === "Under Review") return "Pending";
  if (status === "Rejected" || status === "Archived") return "Suspended";
  return status;
}

export function projectStatusForDisplay(status: string) {
  if (status === "Open for Partnership") return "Active";
  if (status === "Approved" || status === "Partially Supported") return "Active";
  if (status === "Rejected" || status === "Archived") return "Hidden";
  if (status === "Under Review") return "Pending Approval";
  if (status === "Completed") return "Completed";
  return status === "Featured" ? "Featured" : "Active";
}
