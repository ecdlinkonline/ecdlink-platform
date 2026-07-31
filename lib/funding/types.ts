export type FundingOpportunityType =
  | "Government funding"
  | "CSI funding"
  | "NGO funding"
  | "Donor funding"
  | "Equipment funding"
  | "Nutrition funding"
  | "Infrastructure funding"
  | "Training funding";

export type FundingApplicationStatus = "Draft" | "In Progress" | "Ready" | "Submitted" | "Approved" | "Rejected";

export type FundingChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  note: string;
};

export type FundingProjectProfile = {
  id: string;
  title: string;
  opportunityType: FundingOpportunityType;
  funderType: FundingOpportunityType;
  requestedAmount: number;
  beneficiaries: number;
  status: FundingApplicationStatus;
  objective: string;
};

export type FundingReadinessRecord = {
  id: string;
  centreId: string;
  centreName: string;
  region: string;
  area: string;
  contactPerson: string;
  readinessScore: number;
  status: FundingApplicationStatus;
  funderType: FundingOpportunityType;
  projectProfiles: FundingProjectProfile[];
  applicationChecklist: FundingChecklistItem[];
  supportingDocuments: FundingChecklistItem[];
  applicationTracker: Array<{ stage: string; status: FundingApplicationStatus; date: string | null }>;
  adminNotes: string[];
  lastUpdatedAt: string;
};

export type FundingReadinessLiveRecord = FundingReadinessRecord & {
  readinessStatus: string;
  applicationStatus: FundingApplicationStatus;
  approvedAmount: number;
  fundingOrganisation: string | null;
  fundingOpportunity: string | null;
};

export type FundingFilters = {
  query?: string;
  region?: string;
  status?: FundingApplicationStatus | "All";
  funderType?: FundingOpportunityType | "All";
  readinessBand?: "All" | "80+" | "50-79" | "Below 50";
};

export type FundingReport = {
  totalCentres: number;
  readyCount: number;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalRequested: number;
  averageReadiness: number;
  statusBreakdown: Array<{ label: string; value: number }>;
  funderTypeBreakdown: Array<{ label: string; value: number }>;
  regionalReadiness: Array<{ label: string; value: number }>;
};
