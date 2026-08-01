import type { FundingApplicationStatus, FundingOpportunityType } from "@/lib/funding/types";

export const fundingOpportunityTypes: FundingOpportunityType[] = [
  "Government funding",
  "CSI funding",
  "NGO funding",
  "Donor funding",
  "Equipment funding",
  "Nutrition funding",
  "Infrastructure funding",
  "Training funding"
];

export const expandedFundingOpportunityTypes = [
  ...fundingOpportunityTypes,
  "Learning resources funding",
  "Operational support funding",
  "Emergency relief funding",
  "Capacity building funding"
] as const;

export const fundingStatuses: FundingApplicationStatus[] = ["Draft", "In Progress", "Ready", "Submitted", "Approved", "Rejected"];

export const fundingBuilderPlaceholders = [
  "Proposal builder",
  "Budget builder",
  "Beneficiary list manager",
  "Supporting document pack",
  "Application tracker",
  "Funder matching"
];

export function formatFundingCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

export function fundingStatusToDb(status: FundingApplicationStatus) {
  return status.toUpperCase().replaceAll(" ", "_") as
    | "DRAFT"
    | "IN_PROGRESS"
    | "READY"
    | "SUBMITTED"
    | "CLARIFICATION_REQUESTED"
    | "APPROVED"
    | "REJECTED";
}

export function fundingStatusFromDb(status: string): FundingApplicationStatus {
  const label = status.toLowerCase().replaceAll("_", " ");
  const title = label.replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (title === "In Progress") return "In Progress";
  if (title === "Clarification Requested") return "Clarification Requested";
  if (["Draft", "Ready", "Submitted", "Approved", "Rejected"].includes(title)) return title as FundingApplicationStatus;
  if (title === "Under Review") return "Submitted";
  if (title === "Withdrawn") return "Rejected";
  return "Draft";
}

export function checklistStatusFromBoolean(complete: boolean) {
  return complete ? "COMPLETE" : "IN_PROGRESS";
}
