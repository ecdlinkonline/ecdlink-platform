import { seededCentres } from "@/lib/centres/seed";
import {
  annualMembershipFee,
  formatMembershipCurrency,
  formatMembershipDate,
  membershipReminderTemplates,
} from "@/lib/membership/format";
import type {
  MembershipPaymentStatus,
  MembershipRecord,
  MembershipStatus,
} from "@/lib/membership/types";

export {
  annualMembershipFee,
  formatMembershipCurrency,
  formatMembershipDate,
  membershipReminderTemplates,
};

const statuses: MembershipStatus[] = [
  "Active",
  "Active",
  "Pending",
  "Active",
  "Overdue",
  "Active",
  "Active",
  "Expired",
  "Pending",
  "Active",
  "Overdue",
  "Active",
  "Active",
  "Expired",
  "Active",
  "Pending",
];

const dateSets: Record<
  MembershipStatus,
  {
    start: string;
    expiry: string;
    reminder: string;
  }
> = {
  Active: {
    start: "2026-01-01",
    expiry: "2026-12-31",
    reminder: "2026-11-30",
  },
  Pending: {
    start: "2026-07-01",
    expiry: "2027-06-30",
    reminder: "2027-05-31",
  },
  Expired: {
    start: "2025-04-01",
    expiry: "2026-03-31",
    reminder: "2026-03-01",
  },
  Overdue: {
    start: "2025-07-01",
    expiry: "2026-06-30",
    reminder: "2026-06-01",
  },
  Cancelled: {
    start: "2026-01-01",
    expiry: "2026-01-01",
    reminder: "2026-01-01",
  },
};

function paymentStatus(
  status: MembershipStatus
): MembershipPaymentStatus {
  if (status === "Active") {
    return "Paid";
  }

  if (status === "Overdue") {
    return "Overdue";
  }

  if (
    status === "Expired" ||
    status === "Cancelled"
  ) {
    return "Not Paid";
  }

  return "Pending";
}

export const membershipRecords: MembershipRecord[] =
  seededCentres.slice(0, 16).map(
    (centre, index) => {
      const status = statuses[index];
      const dates = dateSets[status];
      const paid = paymentStatus(status) === "Paid";

      const amountPaid =
        paid
          ? annualMembershipFee
          : status === "Overdue"
            ? 500
            : 0;

      const amountOutstanding =
        status === "Cancelled"
          ? 0
          : annualMembershipFee - amountPaid;

      return {
        id: `membership-${centre.id}`,
        centreId: centre.id,
        centreName: centre.centreName,
        region: centre.region,
        area: centre.area,
        contactPerson: centre.contactPerson,
        emailAddress: centre.emailAddress,
        npoNumber: centre.npoNumber,
        membershipYear: new Date(
          dates.start
        ).getFullYear(),
        annualFee: annualMembershipFee,
        amountPaid,
        amountOutstanding,
        status,
        startDate: dates.start,
        expiryDate: dates.expiry,
        renewalReminderDate: dates.reminder,
        invoiceNumber: `ECDL-MEM-2026-${String(
          index + 1
        ).padStart(4, "0")}`,
        invoiceDate: dates.start,
        invoiceStatus:
          paid
            ? "Paid"
            : status === "Pending"
              ? "Generated"
              : "Sent",
        paymentStatus: paymentStatus(status),
        paymentDate: paid
          ? dates.start
          : undefined,
        paymentMethod: paid
          ? "EFT"
          : undefined,
        receiptNumber: paid
          ? `ECDL-REC-2026-${String(
              index + 1
            ).padStart(4, "0")}`
          : undefined,
        receiptPlaceholder: paid
          ? "Receipt PDF placeholder"
          : "Receipt available after payment",
        lastReminderSent:
          status === "Overdue" ||
          status === "Expired"
            ? "2026-07-08"
            : undefined,
        notes:
          status === "Active"
            ? "Membership in good standing."
            : status === "Cancelled"
              ? "Membership has been cancelled."
              : "Follow up required by ECDLink membership desk.",
        createdAt: dates.start,
        updatedAt: dates.start,
      };
    }
  );