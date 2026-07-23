import { prisma } from "@/lib/db/prisma";
import { annualMembershipFee } from "@/lib/membership/format";
import type { MembershipFilters } from "@/lib/membership/types";
import {
  findMembershipRaw,
  getNextMembershipSequence,
  listMembershipRecords,
  mapMembershipRecord,
  membershipInclude
} from "@/lib/repositories/memberships";
import type {
  CreateMembershipInput,
  MembershipPaymentInput,
  RenewMembershipInput,
  UpdateMembershipInput
} from "@/lib/validators/memberships";

export class MembershipServiceError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

function date(value: string) {
  return new Date(value);
}

function money(value: { toNumber?: () => number } | number | string | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber?.() ?? 0;
}

function invoiceNumber(year: number, sequence: number) {
  return `ECDL-MEM-${year}-${String(sequence + 1).padStart(4, "0")}`;
}

function receiptNumber(year: number, sequence: number) {
  return `ECDL-REC-${year}-${String(sequence + 1).padStart(4, "0")}`;
}

function automatedStatus(input: {
  currentStatus?: string;
  amountPaid: number;
  annualFee: number;
  expiryDate: Date;
  renewalReminderDate: Date;
}) {
  if (input.currentStatus === "CANCELLED") return "CANCELLED";
  const now = new Date();
  const balance = Math.max(input.annualFee - input.amountPaid, 0);
  if (input.expiryDate < now) return "EXPIRED";
  if (balance <= 0 && input.expiryDate >= now) return "ACTIVE";
  if (balance > 0 && input.renewalReminderDate < now) return "OVERDUE";
  return "PENDING";
}

function paymentStatus(amountPaid: number, annualFee: number, status: string) {
  if (status === "CANCELLED") return "NOT_PAID";
  if (amountPaid <= 0) return status === "OVERDUE" ? "OVERDUE" : "NOT_PAID";
  if (amountPaid >= annualFee) return "PAID";
  return "PARTIALLY_PAID";
}

export async function listMembershipsFromDatabase(filters: MembershipFilters = {}) {
  return listMembershipRecords(filters);
}

export async function getMembershipFromDatabase(membershipId: string) {
  const record = await findMembershipRaw(membershipId);
  return record ? mapMembershipRecord(record) : null;
}

export async function createMembership(input: CreateMembershipInput, actorUserId?: string) {
  const existing = await prisma.membership.findUnique({
    where: { centreId_membershipYear: { centreId: input.centreId, membershipYear: input.membershipYear } }
  });

  if (existing) {
    throw new MembershipServiceError("A membership already exists for this centre and membership year.", 409);
  }

  const annualFee = input.annualFee ?? annualMembershipFee;
  const record = await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.create({
      data: {
        centre: { connect: { id: input.centreId } },
        membershipYear: input.membershipYear,
        annualFee,
        amountDue: annualFee,
        amountPaid: 0,
        balance: annualFee,
        startDate: date(input.startDate),
        expiryDate: date(input.expiryDate),
        renewalReminderDate: date(input.renewalReminderDate),
        status: "PENDING",
        paymentStatus: "NOT_PAID",
        notes: input.notes
      },
      include: membershipInclude
    });

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "membership.create",
        entityType: "Membership",
        entityId: membership.id,
        after: JSON.parse(JSON.stringify(membership))
      }
    });

    return membership;
  });

  return mapMembershipRecord(record);
}

export async function updateMembership(membershipId: string, input: UpdateMembershipInput, actorUserId?: string) {
  const before = await findMembershipRaw(membershipId);
  if (!before) throw new MembershipServiceError("Membership record not found.", 404);
  if (before.status === "CANCELLED") throw new MembershipServiceError("Cancelled memberships cannot be edited.", 409);

  const annualFee = input.annualFee ?? money(before.annualFee);
  const amountPaid = money(before.amountPaid);
  const balance = Math.max(annualFee - amountPaid, 0);
  const expiryDate = input.expiryDate ? date(input.expiryDate) : before.expiryDate;
  const renewalReminderDate = input.renewalReminderDate ? date(input.renewalReminderDate) : before.renewalReminderDate;
  const status = automatedStatus({ currentStatus: before.status, amountPaid, annualFee, expiryDate, renewalReminderDate });
  const dbPaymentStatus = paymentStatus(amountPaid, annualFee, status);

  const after = await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.update({
      where: { id: membershipId },
      data: {
        annualFee,
        amountDue: annualFee,
        balance,
        startDate: input.startDate ? date(input.startDate) : undefined,
        expiryDate,
        renewalReminderDate,
        status,
        paymentStatus: dbPaymentStatus,
        notes: input.notes
      },
      include: membershipInclude
    });

    await tx.ecdCentre.update({
      where: { id: membership.centreId },
      data: { membershipStatus: membership.status }
    });

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "membership.update",
        entityType: "Membership",
        entityId: membership.id,
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(membership))
      }
    });

    return membership;
  });

  return mapMembershipRecord(after);
}

export async function activateMembership(membershipId: string, actorUserId?: string) {
  const before = await findMembershipRaw(membershipId);
  if (!before) throw new MembershipServiceError("Membership record not found.", 404);
  if (before.status === "CANCELLED") throw new MembershipServiceError("Cancelled memberships cannot be activated.", 409);

  const status = automatedStatus({
    currentStatus: before.status,
    amountPaid: money(before.amountPaid),
    annualFee: money(before.annualFee),
    expiryDate: before.expiryDate,
    renewalReminderDate: before.renewalReminderDate
  });

  const after = await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.update({
      where: { id: membershipId },
      data: { status, paymentStatus: paymentStatus(money(before.amountPaid), money(before.annualFee), status) },
      include: membershipInclude
    });

    await tx.ecdCentre.update({ where: { id: membership.centreId }, data: { membershipStatus: membership.status } });
    await tx.auditLog.create({ data: { actorUserId, action: "membership.activate", entityType: "Membership", entityId: membership.id } });
    return membership;
  });

  return mapMembershipRecord(after);
}

export async function recordMembershipPayment(membershipId: string, input: MembershipPaymentInput, actorUserId?: string) {
  const before = await findMembershipRaw(membershipId);
  if (!before) throw new MembershipServiceError("Membership record not found.", 404);
  if (before.status === "CANCELLED") throw new MembershipServiceError("Payments cannot be recorded against a cancelled membership.", 409);

  const annualFee = money(before.annualFee);
  const nextPaidTotal = money(before.amountPaid) + input.amount;
  if (!input.allowCredit && nextPaidTotal > annualFee) {
    throw new MembershipServiceError("Payment total cannot exceed the annual membership fee.", 409);
  }

  const balance = Math.max(annualFee - nextPaidTotal, 0);
  const status = automatedStatus({
    currentStatus: before.status,
    amountPaid: nextPaidTotal,
    annualFee,
    expiryDate: before.expiryDate,
    renewalReminderDate: before.renewalReminderDate
  });
  const dbPaymentStatus = paymentStatus(nextPaidTotal, annualFee, status);
  const receiptSequence = await getNextMembershipSequence("receipt", before.membershipYear);

  const after = await prisma.$transaction(async (tx) => {
    const payment = await tx.membershipPayment.create({
      data: {
        membershipId,
        receivedByUserId: actorUserId,
        amount: input.amount,
        status: "PAID",
        paymentMethod: input.paymentMethod,
        receiptReference: input.paymentReference,
        paidAt: date(input.paymentDate)
      }
    });

    await tx.membershipReceipt.create({
      data: {
        membershipId,
        paymentId: payment.id,
        receiptNo: receiptNumber(before.membershipYear, receiptSequence),
        amount: input.amount,
        issuedAt: date(input.paymentDate)
      }
    });

    const membership = await tx.membership.update({
      where: { id: membershipId },
      data: {
        amountPaid: nextPaidTotal,
        balance,
        status,
        paymentStatus: dbPaymentStatus,
        invoices: {
          updateMany: {
            where: { membershipId },
            data: { status: dbPaymentStatus === "PAID" ? "PAID" : "SENT" }
          }
        }
      },
      include: membershipInclude
    });

    await tx.ecdCentre.update({ where: { id: membership.centreId }, data: { membershipStatus: membership.status } });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "membership.payment.record",
        entityType: "Membership",
        entityId: membership.id,
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(membership)),
        metadata: { paymentId: payment.id, amount: input.amount }
      }
    });

    return membership;
  });

  return mapMembershipRecord(after);
}

export async function generateMembershipInvoiceRecord(membershipId: string, dueDate?: string, actorUserId?: string) {
  const before = await findMembershipRaw(membershipId);
  if (!before) throw new MembershipServiceError("Membership record not found.", 404);

  const existing = before.invoices[0];
  if (existing) return mapMembershipRecord(before);

  const invoiceSequence = await getNextMembershipSequence("invoice", before.membershipYear);

  const after = await prisma.$transaction(async (tx) => {
    const invoice = await tx.membershipInvoice.create({
      data: {
        membershipId,
        invoiceNo: invoiceNumber(before.membershipYear, invoiceSequence),
        amount: before.annualFee,
        status: "GENERATED",
        dueAt: dueDate ? date(dueDate) : before.renewalReminderDate
      }
    });

    const membership = await tx.membership.findUniqueOrThrow({
      where: { id: membershipId },
      include: membershipInclude
    });

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "membership.invoice.generate",
        entityType: "MembershipInvoice",
        entityId: invoice.id,
        metadata: { membershipId }
      }
    });

    return membership;
  });

  return mapMembershipRecord(after);
}

export async function generateMembershipReceiptRecord(membershipId: string, actorUserId?: string) {
  const before = await findMembershipRaw(membershipId);
  if (!before) throw new MembershipServiceError("Membership record not found.", 404);
  if (before.receipts[0]) return mapMembershipRecord(before);
  if (money(before.amountPaid) <= 0) throw new MembershipServiceError("A receipt can only be generated after payment is recorded.", 409);

  const receiptSequence = await getNextMembershipSequence("receipt", before.membershipYear);

  const after = await prisma.$transaction(async (tx) => {
    const receipt = await tx.membershipReceipt.create({
      data: {
        membershipId,
        receiptNo: receiptNumber(before.membershipYear, receiptSequence),
        amount: before.amountPaid
      }
    });

    const membership = await tx.membership.findUniqueOrThrow({
      where: { id: membershipId },
      include: membershipInclude
    });

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "membership.receipt.generate",
        entityType: "MembershipReceipt",
        entityId: receipt.id,
        metadata: { membershipId }
      }
    });

    return membership;
  });

  return mapMembershipRecord(after);
}

export async function renewMembership(membershipId: string, input: RenewMembershipInput, actorUserId?: string) {
  const before = await findMembershipRaw(membershipId);
  if (!before) throw new MembershipServiceError("Membership record not found.", 404);
  if (before.status !== "ACTIVE" && before.status !== "EXPIRED" && before.status !== "OVERDUE") {
    throw new MembershipServiceError("Only active, expired or overdue memberships can be renewed.", 409);
  }

  const nextYear = input.membershipYear ?? before.membershipYear + 1;
  const startDate = input.startDate ? date(input.startDate) : new Date(nextYear, 0, 1);
  const expiryDate = input.expiryDate ? date(input.expiryDate) : new Date(nextYear, 11, 31);
  const renewalReminderDate = input.renewalReminderDate ? date(input.renewalReminderDate) : new Date(nextYear, 10, 30);

  return createMembership({
    centreId: before.centreId,
    membershipYear: nextYear,
    startDate: startDate.toISOString(),
    expiryDate: expiryDate.toISOString(),
    renewalReminderDate: renewalReminderDate.toISOString(),
    annualFee: money(before.annualFee),
    notes: input.notes ?? `Renewed from membership ${before.id}.`
  }, actorUserId);
}

export async function cancelMembership(membershipId: string, input: { reason: string }, actorUserId?: string) {
  const before = await findMembershipRaw(membershipId);
  if (!before) throw new MembershipServiceError("Membership record not found.", 404);

  const after = await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.update({
      where: { id: membershipId },
      data: {
        status: "CANCELLED",
        paymentStatus: "NOT_PAID",
        cancelledAt: new Date(),
        notes: before.notes ? `${before.notes}\nCancellation reason: ${input.reason}` : `Cancellation reason: ${input.reason}`
      },
      include: membershipInclude
    });

    await tx.ecdCentre.update({ where: { id: membership.centreId }, data: { membershipStatus: "PENDING" } });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "membership.cancel",
        entityType: "Membership",
        entityId: membership.id,
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(membership)),
        metadata: { reason: input.reason }
      }
    });

    return membership;
  });

  return mapMembershipRecord(after);
}

export async function getMembershipReportsFromDatabase() {
  const memberships = await listMembershipRecords();
  const activeCount = memberships.filter((membership) => membership.status === "Active").length;
  const pendingCount = memberships.filter((membership) => membership.status === "Pending").length;
  const expiredCount = memberships.filter((membership) => membership.status === "Expired").length;
  const overdueCount = memberships.filter((membership) => membership.status === "Overdue").length;
  const expectedAnnualRevenue = memberships.reduce((sum, membership) => sum + membership.annualFee, 0);
  const collectedRevenue = memberships.reduce((sum, membership) => sum + membership.amountPaid, 0);
  const regions = Array.from(new Set(memberships.map((membership) => membership.region)));
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 45);

  return {
    activeCount,
    pendingCount,
    expiredCount,
    overdueCount,
    annualFee: annualMembershipFee,
    expectedAnnualRevenue,
    collectedRevenue,
    outstandingRevenue: Math.max(expectedAnnualRevenue - collectedRevenue, 0),
    statusBreakdown: [
      { label: "Active", value: activeCount },
      { label: "Pending", value: pendingCount },
      { label: "Overdue", value: overdueCount },
      { label: "Expired", value: expiredCount }
    ],
    revenueByRegion: regions.map((region) => ({
      label: region,
      value: memberships.filter((membership) => membership.region === region).reduce((sum, membership) => sum + membership.amountPaid, 0)
    })),
    renewalsDue: memberships.filter((membership) => ["Overdue", "Expired", "Pending"].includes(membership.status)),
    overdueMemberships: memberships.filter((membership) => membership.status === "Overdue"),
    expiringSoon: memberships.filter((membership) => {
      const expiry = new Date(membership.expiryDate);
      return expiry >= now && expiry <= soon;
    })
  };
}
