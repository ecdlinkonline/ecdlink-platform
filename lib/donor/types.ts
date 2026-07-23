export type PartnerType = "Corporate Social Investment (CSI)" | "CSI Department" | "Foundation" | "NGO" | "Individual Donor" | "Government Department" | "Corporate Partner" | "Community Trust";
export type ProjectCategory = "Nutrition Programme" | "Kitchen Upgrade" | "Playground Equipment" | "Learning Resources" | "Infrastructure Repairs" | "Training" | "Furniture" | "ICT Equipment" | "Health & Safety" | "Centre Operations";
export type ProjectStatus = "Draft" | "Pending Approval" | "Featured" | "Active" | "Hidden" | "Completed" | "Approved" | "Submitted" | "Archived";
export type PartnershipRequestType = "Express Interest" | "Request Meeting" | "Sponsor Project" | "Request Proposal" | "Bookmark Project" | "General Partnership" | "Site Visit" | "In-kind Support";

export type PartnerOrganisation = {
  id: string;
  name: string;
  type: PartnerType;
  contactPerson: string;
  email: string;
  focusAreas: ProjectCategory[];
  status: "Pending" | "Under Review" | "Approved" | "Suspended" | "Rejected" | "Archived";
  engagementScore: number;
};

export type ImpactCentre = {
  id: string;
  name: string;
  location: string;
  province: string;
  children: number;
  staff: number;
  registrationStatus: string;
  complianceScore: number;
  fundingReadiness: number;
  membershipStatus: string;
  currentNeeds: ProjectCategory[];
  activeProjectCount: number;
  imageTone: string;
};

export type ImpactProject = {
  id: string;
  centreId: string;
  centreName: string;
  title: string;
  category: ProjectCategory;
  goal: string;
  budget: number;
  progress: number;
  description: string;
  impact: string;
  requiredItems: string[];
  timeline: string;
  status: ProjectStatus;
  province: string;
  photos: Array<{ title: string; tone: string }>;
};

export type PartnershipRequest = {
  id: string;
  partnerId: string;
  projectId: string;
  type: PartnershipRequestType;
  status: "New" | "Submitted" | "In Review" | "Approved" | "Declined" | "Closed" | "Withdrawn";
  createdAt: string;
};

export type PartnerMessage = {
  id: string;
  from: "ECDLink" | "Donor" | "CSI" | "Centre";
  subject: string;
  preview: string;
  createdAt: string;
};

export type DonorReport = {
  totalVerifiedCentres: number;
  centresNeedingSupport: number;
  activeProjects: number;
  totalImpact: number;
  childrenReached: number;
  topViewedCentres: Array<{ label: string; value: number }>;
  mostFundedCategories: Array<{ label: string; value: number }>;
  projectsByProvince: Array<{ label: string; value: number }>;
  fundingPipeline: Array<{ label: string; value: number }>;
  corporateEngagement: Array<{ label: string; value: number }>;
};
