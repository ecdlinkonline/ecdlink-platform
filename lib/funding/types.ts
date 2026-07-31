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

export type FundingReviewApplication = {
  id: string;
  applicationNumber: string;
  projectId: string;
  projectTitle: string;
  status: FundingApplicationStatus;
  requestedAmount: number;
  approvedAmount: number | null;
  fundingOrganisation: string | null;
  fundingOpportunity: string | null;
  submissionMethod: string | null;
  externalReference: string | null;
  submittedAt: string | null;
  decisionDate: string | null;
  rejectionReason: string | null;
  notes: string | null;
  reviewedByUserId: string | null;
  updatedAt: string;
};

export type FundingReviewProject = FundingProjectProfile & {
  amountSecured: number;
  fundingGap: number;
  approvedAt: string | null;
  updatedAt: string;
};

export type FundingReviewChecklistItem = {
  id: string;
  category: string;
  label: string;
  status: string;
  note: string | null;
  required: boolean;
  completedAt: string | null;
};

export type FundingReviewDocument = {
  id: string;
  label: string;
  documentType: string;
  status: string;
  note: string | null;
  fileId: string | null;
  uploadedAt: string | null;
  verifiedAt: string | null;
  updatedAt: string;
};

export type FundingReviewReminder = {
  id: string;
  title: string;
  body: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
};

export type FundingReviewTimelineItem = {
  id: string;
  type: "profile" | "application" | "project" | "document" | "reminder";
  title: string;
  description: string;
  status: string | null;
  occurredAt: string;
};

export type FundingReviewWorkspaceData = {
  summary: FundingReadinessLiveRecord;
  currentApplicationId: string | null;
  applications: FundingReviewApplication[];
  projects: FundingReviewProject[];
  checklistItems: FundingReviewChecklistItem[];
  supportingDocuments: FundingReviewDocument[];
  reminders: FundingReviewReminder[];
  timeline: FundingReviewTimelineItem[];
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
