export type FundingOpportunityType =
  | "Government funding"
  | "CSI funding"
  | "NGO funding"
  | "Donor funding"
  | "Equipment funding"
  | "Nutrition funding"
  | "Infrastructure funding"
  | "Training funding";

export type FundingApplicationStatus = "Draft" | "In Progress" | "Ready" | "Submitted" | "Clarification Requested" | "Approved" | "Rejected";

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
  originalFilename: string | null;
  mimeType: string | null;
  fileSize: number | null;
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
  type: "profile" | "application" | "project" | "document" | "reminder" | "communication" | "note" | "audit";
  title: string;
  description: string;
  status: string | null;
  occurredAt: string;
};

export type FundingReviewerNoteRecord = { id: string; applicationId: string; authorUserId: string; author: string; body: string; createdAt: string; updatedAt: string; canEdit: boolean; canDelete: boolean };
export type FundingCommunicationRecord = { id: string; applicationId: string; type: string; title: string; body: string; author: string; recipient: string; createdAt: string; metadata: unknown };

export type FundingReviewerOption = {
  value: string;
  label: string;
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
  reviewers: FundingReviewerOption[];
  reviewerNotes: FundingReviewerNoteRecord[];
  communications: FundingCommunicationRecord[];
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

export type FundingPartnerAccess = {
  actorUserId: string;
  fundingOrganisationIds: string[];
};

export type FundingPartnerApplicationRecord = {
  id: string;
  applicationNumber: string;
  centreId: string;
  centreName: string;
  projectTitle: string;
  fundingOpportunity: string | null;
  status: FundingApplicationStatus;
  requestedAmount: number;
  approvedAmount: number | null;
  submittedAt: string | null;
  decisionDate: string | null;
  reviewedByUserId: string | null;
  updatedAt: string;
};

export type FundingPartnerCallRecord = {
  id: string;
  title: string;
  type: string | null;
  status: string;
  closesAt: string | null;
  applicationCount: number;
};

export type FundingPartnerAssessmentRecord = {
  id: string;
  applicationId: string | null;
  applicationNumber: string | null;
  centreName: string | null;
  status: string;
  score: number | null;
  updatedAt: string;
};

export type FundingPartnerPortalData = {
  organisationNames: string[];
  metrics: {
    fundingCalls: number;
    assignedApplications: number;
    awaitingReview: number;
    approvals: number;
  };
  reports: {
    assignedApplications: number;
    awaitingReview: number;
    clarificationRequests: number;
    approvalRate: number;
    averageDecisionDays: number;
    fundingCommitted: number;
  };
  myWork: {
    assignedToMe: FundingPartnerApplicationRecord[];
    awaitingReview: FundingPartnerApplicationRecord[];
    clarificationRequests: FundingPartnerApplicationRecord[];
  };
  applications: FundingPartnerApplicationRecord[];
  calls: FundingPartnerCallRecord[];
  assessments: FundingPartnerAssessmentRecord[];
};
