import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { MembershipFilters, MembershipInvoiceStatus, MembershipPaymentStatus, MembershipRecord, MembershipStatus } from "@/lib/membership/types";

export const membershipInclude = {
  centre: true,
  invoices: { orderBy: { issuedAt: "desc" as const } },
  payments: { orderBy: { createdAt: "desc" as const } },
  receipts: { orderBy: { issuedAt: "desc" as const } }
};

export type MembershipWithRelations = Prisma.MembershipGetPayload<{ include: typeof membershipInclude }>;

export const membershipStatusToDb = {
  Active: "ACTIVE",
  Pending: "PENDING",
  Expired: "EXPIRED",
  Overdue: "OVERDUE",
  Cancelled: "CANCELLED"
} as const;

const membershipStatusFromDb: Record<string, MembershipStatus> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  EXPIRED: "Expired",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled"
};

export const paymentStatusToDb = {
  "Not Paid": "NOT_PAID",
  "Partially Paid": "PARTIALLY_PAID",
  Paid: "PAID",
  Refunded: "REFUNDED",
  Pending: "PENDING",
  Overdue: "OVERDUE"
} as const;

const paymentStatusFromDb: Record<string, MembershipPaymentStatus> = {
  NOT_PAID: "Not Paid",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  REFUNDED: "Refunded",
  PENDING: "Pending",
  OVERDUE: "Overdue",
  FAILED: "Not Paid"
};

const invoiceStatusFromDb: Record<string, MembershipInvoiceStatus> = {
  DRAFT: "Not Generated",
  GENERATED: "Generated",
  SENT: "Sent",
  PAID: "Paid",
  CANCELLED: "Not Generated"
};

function iso(value?: Date | null) {
  return value ? value.toISOString() : undefined;
}

function money(value: { toNumber?: () => number } | number | string | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber?.() ?? 0;
}

export function mapMembershipRecord(record: MembershipWithRelations): MembershipRecord {
  const latestInvoice = record.invoices[0];
  const latestPayment = record.payments[0];
  const latestReceipt = record.receipts[0];

  return {
    id: record.id,
    centreId: record.centreId,
    centreName: record.centre.centreName,
    region: record.centre.region ?? "Unassigned",
    area: record.centre.area ?? "Unassigned",
    contactPerson: record.centre.contactPerson ?? record.centre.principalName ?? "Not captured",
    emailAddress: record.centre.email ?? "Not captured",
    npoNumber: record.centre.npoNumber ?? undefined,
    membershipYear: record.membershipYear,
    annualFee: money(record.annualFee),
    amountPaid: money(record.amountPaid),
    amountOutstanding: money(record.balance),
    status: membershipStatusFromDb[record.status] ?? "Pending",
    startDate: record.startDate.toISOString(),
    expiryDate: record.expiryDate.toISOString(),
    renewalReminderDate: record.renewalReminderDate.toISOString(),
    invoiceNumber: latestInvoice?.invoiceNo ?? "Not generated",
    invoiceDate: iso(latestInvoice?.issuedAt),
    invoiceStatus: invoiceStatusFromDb[latestInvoice?.status ?? "DRAFT"] ?? "Not Generated",
    paymentStatus: paymentStatusFromDb[record.paymentStatus] ?? "Not Paid",
    paymentDate: iso(latestPayment?.paidAt),
    paymentMethod: latestPayment?.paymentMethod ?? undefined,
    receiptNumber: latestReceipt?.receiptNo,
    receiptPlaceholder: latestReceipt ? "Receipt PDF placeholder" : "Receipt available after payment",
    notes: record.notes ?? "",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function listWhere(filters: MembershipFilters): Prisma.MembershipWhereInput {
  const query = filters.query?.trim();
  const where: Prisma.MembershipWhereInput = {};

  if (filters.status && filters.status !== "All") where.status = membershipStatusToDb[filters.status];
  if (filters.paymentStatus && filters.paymentStatus !== "All") where.paymentStatus = paymentStatusToDb[filters.paymentStatus];
  if (filters.year && filters.year !== "All") where.membershipYear = filters.year;
  if (filters.region && filters.region !== "All") where.centre = { region: filters.region };

  if (query) {
    where.OR = [
      { centre: { centreName: { contains: query, mode: "insensitive" } } },
      { centre: { npoNumber: { contains: query, mode: "insensitive" } } },
      { centre: { region: { contains: query, mode: "insensitive" } } },
      { centre: { area: { contains: query, mode: "insensitive" } } },
      { invoices: { some: { invoiceNo: { contains: query, mode: "insensitive" } } } }
    ];
  }

  return where;
}

export async function listMembershipRecords(filters: MembershipFilters = {}) {
  const records = await prisma.membership.findMany({
    where: listWhere(filters),
    include: membershipInclude,
    orderBy: [{ membershipYear: "desc" }, { centre: { centreName: "asc" } }]
  });
  return records.map(mapMembershipRecord);
}

export async function getMembershipRecordById(membershipId: string) {
  const record = await prisma.membership.findUnique({ where: { id: membershipId }, include: membershipInclude });
  return record ? mapMembershipRecord(record) : null;
}

export async function getMembershipRecordByCentreId(centreId: string) {
  const record = await prisma.membership.findFirst({
    where: { centreId },
    include: membershipInclude,
    orderBy: [{ membershipYear: "desc" }, { createdAt: "desc" }]
  });
  return record ? mapMembershipRecord(record) : null;
}

export async function getCentreIdForClerkUser(clerkUserId: string) {
  const centreUser = await prisma.centreUser.findFirst({
    where: { user: { clerkUserId } },
    select: { centreId: true }
  });
  return centreUser?.centreId ?? null;
}

export async function getDbUserIdForClerkUser(clerkUserId: string) {
  const user = await prisma.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  return user?.id ?? null;
}

export async function createMembershipRecord(data: Prisma.MembershipCreateInput) {
  const record = await prisma.membership.create({ data, include: membershipInclude });
  return mapMembershipRecord(record);
}

export async function updateMembershipRecord(membershipId: string, data: Prisma.MembershipUpdateInput) {
  const record = await prisma.membership.update({ where: { id: membershipId }, data, include: membershipInclude });
  return mapMembershipRecord(record);
}

export async function findMembershipRaw(membershipId: string) {
  return prisma.membership.findUnique({ where: { id: membershipId }, include: membershipInclude });
}

export async function getNextMembershipSequence(model: "invoice" | "receipt", year: number) {
  if (model === "invoice") {
    return prisma.membershipInvoice.count({
      where: { invoiceNo: { startsWith: `ECDL-MEM-${year}-` } }
    });
  }

  return prisma.membershipReceipt.count({
    where: { receiptNo: { startsWith: `ECDL-REC-${year}-` } }
  });
}
