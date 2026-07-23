export type ComplianceDocumentType =
  | "NPO Certificate"
  | "Constitution"
  | "DBE Registration / Partial Care Certificate"
  | "Tax Clearance / PIN"
  | "Tax Clearance / Tax Compliance PIN"
  | "Bank Confirmation Letter"
  | "Bank Statement"
  | "Committee List"
  | "Committee ID Copies"
  | "Staff List"
  | "Children List / Claim Form"
  | "Proof of Residence"
  | "Health & Safety Documents"
  | "Health and Safety Documents"
  | "Fire Certificate"
  | "Fire Certificate placeholder"
  | "Food Handling / Kitchen Compliance"
  | "Food Handling / Kitchen Compliance placeholder"
  | "Centre Photos";

export type ComplianceDocumentStatus = "Uploaded" | "Missing" | "Expired" | "Expiring Soon" | "Verified" | "Rejected" | "Archived";
export type ComplianceVerificationStatus = "Pending Review" | "Verified" | "Rejected" | "Requires Resubmission";
export type ComplianceScoreLight = "Green" | "Amber" | "Red";

export type ComplianceDocumentRecord = {
  id: string;
  requirementId?: string | null;
  type: ComplianceDocumentType;
  status: ComplianceDocumentStatus;
  verificationStatus?: ComplianceVerificationStatus;
  documentNumber?: string | null;
  issueDate?: string | null;
  expiryDate: string | null;
  uploadedAt: string | null;
  submittedAt?: string | null;
  fileName: string | null;
  fileAssetId?: string | null;
  verificationNote: string;
  rejectionReason?: string | null;
  adminNotes?: string | null;
  reminderDate: string | null;
  replacementDocumentId?: string | null;
  archivedAt?: string | null;
};

export type CentreComplianceRecord = {
  id: string;
  centreId: string;
  centreName: string;
  region: string;
  area: string;
  contactPerson: string;
  score: number;
  scoreLight: ComplianceScoreLight;
  totalRequirements?: number;
  verifiedDocuments?: number;
  pendingDocuments?: number;
  missingDocuments?: number;
  rejectedDocuments?: number;
  expiredDocuments?: number;
  expiringSoonDocuments?: number;
  nextRequiredAction?: string;
  documents: ComplianceDocumentRecord[];
  adminVerificationNotes: string[];
  lastUpdatedAt: string;
};

export type ComplianceFilters = {
  query?: string;
  region?: string;
  documentStatus?: ComplianceDocumentStatus | "All";
  scoreLight?: ComplianceScoreLight | "All";
};

export type ComplianceReport = {
  totalCentres: number;
  greenCount: number;
  amberCount: number;
  redCount: number;
  verifiedDocuments: number;
  missingDocuments: number;
  expiredDocuments: number;
  expiringSoonDocuments: number;
  scoreBreakdown: Array<{ label: string; value: number }>;
  documentStatusBreakdown: Array<{ label: string; value: number }>;
  regionalReadiness: Array<{ label: string; value: number }>;
};
