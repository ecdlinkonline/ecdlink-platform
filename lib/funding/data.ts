import { seededCentres } from "@/lib/centres/seed";
import type {
  FundingApplicationStatus,
  FundingChecklistItem,
  FundingOpportunityType,
  FundingProjectProfile,
  FundingReadinessRecord
} from "@/lib/funding/types";

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

const statuses: FundingApplicationStatus[] = [
  "Ready",
  "Submitted",
  "In Progress",
  "Approved",
  "Draft",
  "Ready",
  "Rejected",
  "In Progress",
  "Submitted",
  "Draft",
  "Ready",
  "Approved",
  "In Progress",
  "Submitted",
  "Draft",
  "Ready"
];

const checklistLabels = [
  "Centre profile complete",
  "Compliance documents checked",
  "Project proposal drafted",
  "Budget completed",
  "Beneficiary list prepared",
  "Supporting documents attached",
  "Admin review completed",
  "Submission pack ready"
];

const supportingDocumentLabels = [
  "NPO Certificate",
  "DBE / Partial Care Certificate",
  "Tax Clearance / PIN",
  "Bank Confirmation Letter",
  "Latest Bank Statement",
  "Committee ID Copies",
  "Beneficiary List",
  "Project Budget",
  "Project Proposal",
  "Centre Photos"
];

export function formatFundingCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

function buildChecklist(seed: string, labels: string[], completionOffset: number): FundingChecklistItem[] {
  return labels.map((label, index) => ({
    id: `${seed}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    label,
    complete: index < completionOffset || (index + completionOffset) % 5 === 0,
    note: index < completionOffset ? "Ready for funding pack." : "Needs follow-up before submission."
  }));
}

function projectForCentre(centreId: string, centreName: string, centreIndex: number): FundingProjectProfile[] {
  const primaryType = fundingOpportunityTypes[centreIndex % fundingOpportunityTypes.length];
  const secondaryType = fundingOpportunityTypes[(centreIndex + 3) % fundingOpportunityTypes.length];
  const beneficiaries = 35 + centreIndex * 4;

  return [
    {
      id: `${centreId}-primary-project`,
      title: `${primaryType.replace(" funding", "")} support for ${centreName}`,
      opportunityType: primaryType,
      funderType: primaryType,
      requestedAmount: 18000 + centreIndex * 4500,
      beneficiaries,
      status: statuses[centreIndex],
      objective: "Prepare a complete funder-ready application pack with proposal, budget, beneficiaries and supporting evidence."
    },
    {
      id: `${centreId}-secondary-project`,
      title: `${secondaryType.replace(" funding", "")} readiness project`,
      opportunityType: secondaryType,
      funderType: secondaryType,
      requestedAmount: 12000 + centreIndex * 2200,
      beneficiaries: Math.max(20, beneficiaries - 12),
      status: centreIndex % 3 === 0 ? "Draft" : "In Progress",
      objective: "Build a secondary project profile for future funding calls and partner matching."
    }
  ];
}

export const fundingReadinessRecords: FundingReadinessRecord[] = seededCentres.slice(0, 16).map((centre, index) => {
  const completionOffset = 3 + (index % 6);
  const applicationChecklist = buildChecklist(centre.id, checklistLabels, completionOffset);
  const supportingDocuments = buildChecklist(`${centre.id}-docs`, supportingDocumentLabels, completionOffset + (index % 2));
  const readinessScore = Math.round(((applicationChecklist.filter((item) => item.complete).length + supportingDocuments.filter((item) => item.complete).length) / (applicationChecklist.length + supportingDocuments.length)) * 100);
  const status = statuses[index];
  const funderType = fundingOpportunityTypes[index % fundingOpportunityTypes.length];

  return {
    id: `funding-${centre.id}`,
    centreId: centre.id,
    centreName: centre.centreName,
    region: centre.region,
    area: centre.area,
    contactPerson: centre.contactPerson,
    readinessScore,
    status,
    funderType,
    projectProfiles: projectForCentre(centre.id, centre.centreName, index),
    applicationChecklist,
    supportingDocuments,
    applicationTracker: [
      { stage: "Opportunity matched", status: "Approved", date: "2026-07-01" },
      { stage: "Proposal builder", status: readinessScore >= 45 ? "In Progress" : "Draft", date: "2026-07-03" },
      { stage: "Budget builder", status: readinessScore >= 60 ? "Ready" : "In Progress", date: "2026-07-05" },
      { stage: "Beneficiary list", status: readinessScore >= 70 ? "Ready" : "Draft", date: "2026-07-06" },
      { stage: "Supporting documents", status: readinessScore >= 80 ? "Ready" : "In Progress", date: null },
      { stage: "Application submitted", status: status === "Submitted" || status === "Approved" ? status : "Draft", date: status === "Submitted" || status === "Approved" ? "2026-07-09" : null }
    ],
    adminNotes: [
      readinessScore >= 80 ? "Ready for funder matching and submission review." : "Funding desk should help complete checklist and evidence gaps.",
      "Donor portal connection is intentionally a placeholder for a future module."
    ],
    lastUpdatedAt: "2026-07-10"
  };
});

export const fundingBuilderPlaceholders = [
  "Proposal builder placeholder",
  "Budget builder placeholder",
  "Beneficiary list manager placeholder",
  "Supporting document pack placeholder",
  "Future donor portal connection placeholder"
];
