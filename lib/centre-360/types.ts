import type { EcdCentre } from "@/lib/centres/types";
import type { CentreComplianceRecord } from "@/lib/compliance/types";
import type { FundingReadinessRecord } from "@/lib/funding/types";
import type { MembershipRecord } from "@/lib/membership/types";
import type { CentreOrder } from "@/lib/procurement/types";

export type CentreHealthLabel = "Excellent" | "Good" | "Needs Attention" | "Critical";
export type CentreRiskLevel = "Low" | "Medium" | "High" | "Critical";

export type UnifiedCentreDocument = {
  id: string;
  title: string;
  source: "Compliance" | "Membership" | "Procurement" | "Funding" | "Centre";
  status: string;
  expiryDate: string | null;
  fileName: string | null;
};

export type UnifiedCentreTimelineItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  source: "Profile" | "Membership" | "Compliance" | "Procurement" | "Funding" | "Document" | "Note";
};

export type UnifiedCentreAction = {
  id: string;
  title: string;
  description: string;
  status: string;
};

export type UnifiedCentreProfile = {
  centre: EcdCentre;
  membership: MembershipRecord | null;
  compliance: CentreComplianceRecord | null;
  funding: FundingReadinessRecord | null;
  procurementOrders: CentreOrder[];
  documents: UnifiedCentreDocument[];
  timeline: UnifiedCentreTimelineItem[];
  outstandingActions: UnifiedCentreAction[];
  healthScore: number;
  healthLabel: CentreHealthLabel;
  riskLevel: CentreRiskLevel;
};
