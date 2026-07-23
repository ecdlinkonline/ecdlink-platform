export const annualMembershipFee = 1250;

export const membershipReminderTemplates = [
  "Renewal reminder queued",
  "Invoice generated",
  "Payment status placeholder updated",
  "Receipt placeholder ready after payment confirmation"
];

export function formatMembershipCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

export function formatMembershipDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
