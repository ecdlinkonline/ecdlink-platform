export type RegistrationStatus = "Registered" | "In Progress" | "Not Registered";
export type MembershipStatus = "Active" | "Pending" | "Expired";
export type ParticipationStatus = "Active" | "Inactive" | "Pending";
export type ReadinessStatus = "Ready" | "In Progress" | "Needs Attention";
export type ComplianceStatus = "Compliant" | "Attention" | "Action Required";

export type CentrePhoto = {
  id: string;
  title: string;
  tone: string;
  uploadedAt: string;
};

export type CentreNote = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type CentreActivity = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  type: "profile" | "membership" | "procurement" | "compliance" | "funding" | "note";
};

export type EcdCentre = {
  id: string;
  centreName: string;
  registrationStatus: RegistrationStatus;
  npoNumber: string;
  dbeRegistrationStatus: string;
  physicalAddress: string;
  area: string;
  region: string;
  contactPerson: string;
  phoneNumber: string;
  emailAddress: string;
  numberOfChildren: number;
  numberOfStaff: number;
  principalName: string;
  membershipStatus: MembershipStatus;
  procurementStatus: ParticipationStatus;
  complianceStatus: ComplianceStatus;
  fundingReadinessStatus: ReadinessStatus;
  centrePhotos: CentrePhoto[];
  notes: CentreNote[];
  activityTimeline: CentreActivity[];
  createdDate: string;
  lastUpdatedDate: string;
};

export type CentreFilters = {
  query?: string;
  area?: string;
  registrationStatus?: RegistrationStatus | "All";
  complianceStatus?: ComplianceStatus | "All";
  membershipStatus?: MembershipStatus | "All";
  procurementStatus?: ParticipationStatus | "All";
};
