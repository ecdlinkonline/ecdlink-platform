import type { ComplianceScoreLight } from "@/lib/compliance/types";

export const renewalReminderOptions = [
  "60 days before expiry",
  "30 days before expiry",
  "14 days before expiry",
  "7 days before expiry",
  "On expiry date"
];

export const complianceRequirementSeed = [
  "NPO Certificate",
  "Constitution",
  "DBE Registration / Partial Care Certificate",
  "Tax Clearance / Tax Compliance PIN",
  "Bank Confirmation Letter",
  "Bank Statement",
  "Committee List",
  "Committee ID Copies",
  "Staff List",
  "Children List / Claim Form",
  "Proof of Residence",
  "Health and Safety Documents",
  "Fire Certificate",
  "Food Handling / Kitchen Compliance",
  "Centre Photos"
] as const;

export function formatComplianceDate(value: string | null) {
  if (!value) return "Not uploaded";
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function getScoreLight(score: number): ComplianceScoreLight {
  if (score >= 85) return "Green";
  if (score >= 50) return "Amber";
  return "Red";
}

export function requirementCode(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}
