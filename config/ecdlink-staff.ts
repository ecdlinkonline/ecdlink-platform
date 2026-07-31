import type { EcdlinkStaffDepartment } from "@prisma/client";

export type StaffDepartmentConfig = {
  label: string;
  focus: string;
  defaultPriorities: string[];
};

export const staffDepartmentConfig: Record<EcdlinkStaffDepartment, StaffDepartmentConfig> = {
  OPERATIONS: {
    label: "Operations",
    focus: "Daily centre operations, escalation routing and support coordination.",
    defaultPriorities: ["Review open support cases", "Check centre assignment coverage", "Resolve overdue follow-ups"]
  },
  CENTRE_SUPPORT: {
    label: "Centre Support",
    focus: "Principal support, visits, coaching sessions and centre follow-ups.",
    defaultPriorities: ["Prepare for centre sessions", "Update support notes", "Confirm next visits"]
  },
  COMPLIANCE: {
    label: "Compliance",
    focus: "Document readiness, verification support and expiry tracking.",
    defaultPriorities: ["Review missing documents", "Follow up expiring records", "Capture verification notes"]
  },
  FAMILY_SUPPORT: {
    label: "Family Support",
    focus: "Family engagement, referrals and social support coordination.",
    defaultPriorities: ["Check family support cases", "Prepare referral notes", "Follow up centre escalations"]
  },
  PROCUREMENT: {
    label: "Procurement",
    focus: "Monthly orders, supplier coordination and delivery readiness.",
    defaultPriorities: ["Review procurement exceptions", "Confirm centre order support", "Check delivery follow-ups"]
  },
  EVENTS: {
    label: "Events",
    focus: "ECDLink events, attendance support and centre communications.",
    defaultPriorities: ["Confirm event registrations", "Prepare centre reminders", "Review attendance follow-ups"]
  },
  FUNDING: {
    label: "Funding",
    focus: "Funding readiness, proposal support and application tracking.",
    defaultPriorities: ["Review readiness gaps", "Prepare proposal notes", "Check application milestones"]
  },
  TRAINING: {
    label: "Training",
    focus: "Practitioner training, learning sessions and attendance reporting.",
    defaultPriorities: ["Prepare training sessions", "Review attendance", "Update learning follow-ups"]
  },
  FINANCE: {
    label: "Finance",
    focus: "Membership billing, procurement finance support and payment follow-ups.",
    defaultPriorities: ["Review overdue memberships", "Check invoice follow-ups", "Prepare payment notes"]
  },
  MONITORING_AND_EVALUATION: {
    label: "Monitoring and Evaluation",
    focus: "Outcome tracking, reports, centre evidence and data quality.",
    defaultPriorities: ["Review reporting gaps", "Check centre evidence", "Prepare data quality notes"]
  },
  MANAGEMENT: {
    label: "Management",
    focus: "Team oversight, operational risk and network-level performance.",
    defaultPriorities: ["Review network risk", "Check team workload", "Prepare management actions"]
  }
};
