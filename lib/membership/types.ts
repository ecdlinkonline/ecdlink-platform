export type MembershipStatus = "Active" | "Expired" | "Pending" | "Overdue" | "Cancelled";
export type MembershipPaymentStatus = "Paid" | "Partially Paid" | "Pending" | "Overdue" | "Not Paid" | "Refunded";
export type MembershipInvoiceStatus = "Not Generated" | "Generated" | "Sent" | "Paid";

export type MembershipRecord = {
  id: string;
  centreId: string;
  centreName: string;
  region: string;
  area: string;
  contactPerson: string;
  emailAddress: string;
  npoNumber?: string;
  membershipYear: number;
  annualFee: number;
  amountPaid: number;
  amountOutstanding: number;
  status: MembershipStatus;
  startDate: string;
  expiryDate: string;
  renewalReminderDate: string;
  invoiceNumber: string;
  invoiceDate?: string;
  invoiceStatus: MembershipInvoiceStatus;
  paymentStatus: MembershipPaymentStatus;
  paymentDate?: string;
  paymentMethod?: string;
  receiptNumber?: string;
  receiptPlaceholder: string;
  lastReminderSent?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type MembershipFilters = {
  query?: string;
  status?: MembershipStatus | "All";
  paymentStatus?: MembershipPaymentStatus | "All";
  region?: string;
  year?: number | "All";
};

export type MembershipReport = {
  activeCount: number;
  pendingCount: number;
  expiredCount: number;
  overdueCount: number;
  annualFee: number;
  expectedAnnualRevenue: number;
  collectedRevenue: number;
  outstandingRevenue: number;
  statusBreakdown: Array<{ label: string; value: number }>;
  revenueByRegion: Array<{ label: string; value: number }>;
  renewalsDue: MembershipRecord[];
  overdueMemberships: MembershipRecord[];
  expiringSoon: MembershipRecord[];
};

export type MembershipActivity = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
};
