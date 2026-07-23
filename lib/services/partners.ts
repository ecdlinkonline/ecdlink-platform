import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/repositories/audit-logs";
import type { commitmentSchema, fulfilmentSchema, impactReportSchema, messageSchema, partnerOrganisationSchema, partnerUserSchema, partnershipRequestSchema, projectUpdateSchema } from "@/lib/validators/partners";
import type { z } from "zod";

function money(value?: number) {
  return value === undefined ? undefined : value.toFixed(2);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function partnerPermissionsForRole(role: string) {
  const map: Record<string, string[]> = {
    OWNER: ["partner.read", "partner.manage", "requests.manage", "commitments.manage", "reports.read", "messages.manage"],
    ADMINISTRATOR: ["partner.read", "partner.manage", "requests.manage", "reports.read", "messages.manage"],
    PROGRAMME_MANAGER: ["partner.read", "requests.manage", "messages.manage", "reports.read"],
    FINANCE: ["partner.read", "commitments.manage", "reports.read"],
    MONITORING_EVALUATION: ["partner.read", "reports.read"],
    VIEWER: ["partner.read"]
  };
  return map[role] ?? ["partner.read"];
}

export async function createPartnerOrganisation(input: z.infer<typeof partnerOrganisationSchema>, actorUserId: string) {
  const org = await prisma.donorOrganisation.create({
    data: { name: input.organisationName, organisationName: input.organisationName, slug: `${slugify(input.organisationName)}-${Date.now()}`, type: input.organisationType, organisationType: input.organisationType, contactPerson: input.contactPerson, phone: input.phone, email: input.email, focusAreas: input.focusAreas, preferredRegions: input.preferredRegions, annualSupportBudget: money(input.annualSupportBudget), status: "Pending", verificationStatus: "Pending Verification" }
  });
  await createAuditLog({ actorUserId, action: "partner.create", entityType: "DonorOrganisation", entityId: org.id, after: org });
  return org;
}

export async function setPartnerStatus(partnerId: string, status: "Approved" | "Rejected" | "Suspended" | "Archived", actorUserId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.donorOrganisation.findUnique({ where: { id: partnerId } });
    const after = await tx.donorOrganisation.update({ where: { id: partnerId }, data: { status, verificationStatus: status === "Approved" ? "Verified" : status === "Rejected" ? "Rejected" : undefined, approvedAt: status === "Approved" ? new Date() : undefined, approvedByUserId: status === "Approved" ? actorUserId : undefined, suspendedAt: status === "Suspended" ? new Date() : undefined, suspensionReason: status === "Suspended" ? reason : undefined, archivedAt: status === "Archived" ? new Date() : undefined } });
    await tx.notification.create({ data: { title: `Partner ${status.toLowerCase()}`, body: `${after.organisationName ?? after.name} status is now ${status}.` } });
    await tx.auditLog.create({ data: { actorUserId, action: `partner.${status.toLowerCase()}`, entityType: "DonorOrganisation", entityId: partnerId, before: before ? JSON.parse(JSON.stringify(before)) : undefined, after: JSON.parse(JSON.stringify(after)), metadata: reason ? { reason } : undefined } });
    return after;
  });
}

export async function addPartnerUser(partnerId: string, input: z.infer<typeof partnerUserSchema>, actorUserId: string) {
  const user = await prisma.donorUser.upsert({ where: { donorOrganisationId_userId: { donorOrganisationId: partnerId, userId: input.userId } }, update: { role: input.role, permissions: input.permissions.length ? input.permissions : partnerPermissionsForRole(input.role), status: "ACTIVE", removedAt: null, isPrimary: input.isPrimary ?? false }, create: { donorOrganisationId: partnerId, userId: input.userId, role: input.role, permissions: input.permissions.length ? input.permissions : partnerPermissionsForRole(input.role), isPrimary: input.isPrimary ?? false } });
  await createAuditLog({ actorUserId, action: "partner.user.add", entityType: "DonorUser", entityId: user.id, after: user });
  return user;
}

export async function removePartnerUser(partnerUserId: string, actorUserId: string) {
  const before = await prisma.donorUser.findUnique({ where: { id: partnerUserId } });
  const after = await prisma.donorUser.update({ where: { id: partnerUserId }, data: { status: "REMOVED", removedAt: new Date(), isPrimary: false } });
  await createAuditLog({ actorUserId, action: "partner.user.remove", entityType: "DonorUser", entityId: partnerUserId, before, after });
  return after;
}

export async function createPartnershipRequest(partnerId: string, input: z.infer<typeof partnershipRequestSchema>, actorUserId: string) {
  const request = await prisma.partnershipRequest.create({ data: { donorOrganisationId: partnerId, centreId: input.centreId, impactProjectId: input.impactProjectId, type: input.requestType, requestType: input.requestType, message: input.message, proposedSupportType: input.proposedSupportType, proposedAmount: money(input.proposedAmount), proposedItems: input.proposedItems === undefined ? undefined : input.proposedItems as never, preferredMeetingDate: input.preferredMeetingDate, status: "Submitted", requestStatus: "Submitted", submittedByUserId: actorUserId, submittedAt: new Date() } });
  await createAuditLog({ actorUserId, action: "partner.request.submit", entityType: "PartnershipRequest", entityId: request.id, after: request });
  return request;
}

export async function setPartnershipRequestStatus(requestId: string, status: string, actorUserId: string, notes?: string) {
  const before = await prisma.partnershipRequest.findUnique({ where: { id: requestId } });
  const after = await prisma.partnershipRequest.update({ where: { id: requestId }, data: { status, requestStatus: status, adminNotes: notes, reviewedAt: new Date(), closedAt: ["Closed", "Declined", "Withdrawn"].includes(status) ? new Date() : undefined } });
  await createAuditLog({ actorUserId, action: "partner.request.status", entityType: "PartnershipRequest", entityId: requestId, before, after });
  return after;
}

export async function createCommitment(partnerId: string, input: z.infer<typeof commitmentSchema>, actorUserId: string) {
  const commitment = await prisma.sponsorshipCommitment.create({ data: { donorOrganisationId: partnerId, partnershipRequestId: input.partnershipRequestId, centreId: input.centreId, impactProjectId: input.impactProjectId, commitmentType: input.commitmentType, committedAmount: money(input.committedAmount), committedItems: input.committedItems as never, committedServices: input.committedServices as never, expectedFulfilmentDate: input.expectedFulfilmentDate, commitmentStatus: "Proposed", referenceNumber: `ECDL-COM-${Date.now()}`, notes: input.notes, createdByUserId: actorUserId } });
  await createAuditLog({ actorUserId, action: "partner.commitment.create", entityType: "SponsorshipCommitment", entityId: commitment.id, after: commitment });
  return commitment;
}

export async function updateCommitmentFulfilment(commitmentId: string, input: z.infer<typeof fulfilmentSchema>, actorUserId: string) {
  const before = await prisma.sponsorshipCommitment.findUnique({ where: { id: commitmentId } });
  const after = await prisma.sponsorshipCommitment.update({ where: { id: commitmentId }, data: { fulfilledDate: input.fulfilledDate ?? new Date(), commitmentStatus: input.status ?? "Fulfilled", notes: input.notes } });
  await createAuditLog({ actorUserId, action: "partner.commitment.fulfilment", entityType: "SponsorshipCommitment", entityId: commitmentId, before, after });
  return after;
}

export async function bookmarkProject(partnerId: string, projectId: string, actorUserId: string) {
  const existing = await prisma.partnerBookmark.findFirst({ where: { donorOrganisationId: partnerId, impactProjectId: projectId, centreId: null, impactReportId: null } });
  const bookmark = existing ?? await prisma.partnerBookmark.create({ data: { donorOrganisationId: partnerId, impactProjectId: projectId, bookmarkType: "project", userId: actorUserId } });
  await createAuditLog({ actorUserId, action: "partner.project.bookmark", entityType: "PartnerBookmark", entityId: bookmark.id, after: bookmark });
  return bookmark;
}

export async function removeProjectBookmark(partnerId: string, projectId: string) {
  return prisma.partnerBookmark.deleteMany({ where: { donorOrganisationId: partnerId, impactProjectId: projectId } });
}

export async function createProjectUpdate(input: z.infer<typeof projectUpdateSchema>, actorUserId: string) {
  const update = await prisma.projectUpdate.create({ data: { ...input, updateDate: new Date(), createdByUserId: actorUserId, visibility: input.visibility ?? "Private" } });
  await createAuditLog({ actorUserId, action: "partner.project_update.submit", entityType: "ProjectUpdate", entityId: update.id, after: update });
  return update;
}

export async function approveProjectUpdate(updateId: string, actorUserId: string) {
  const after = await prisma.projectUpdate.update({ where: { id: updateId }, data: { visibility: "Partner", approvedAt: new Date(), approvedByUserId: actorUserId } });
  await createAuditLog({ actorUserId, action: "partner.project_update.approve", entityType: "ProjectUpdate", entityId: updateId, after });
  return after;
}

export async function createImpactReport(input: z.infer<typeof impactReportSchema>, actorUserId: string) {
  const report = await prisma.impactReport.create({ data: { ...input, amountAllocated: money(input.amountAllocated), amountUsed: money(input.amountUsed), title: input.title, preparedByUserId: actorUserId, status: "Draft", visibility: "Private" } });
  await createAuditLog({ actorUserId, action: "partner.impact_report.submit", entityType: "ImpactReport", entityId: report.id, after: report });
  return report;
}

export async function approveImpactReport(reportId: string, actorUserId: string, shared = false) {
  const after = await prisma.impactReport.update({ where: { id: reportId }, data: { status: shared ? "Shared" : "Approved", visibility: "Partner", approvedAt: new Date(), reviewedByUserId: actorUserId } });
  await createAuditLog({ actorUserId, action: shared ? "partner.impact_report.share" : "partner.impact_report.approve", entityType: "ImpactReport", entityId: reportId, after });
  return after;
}

export async function createPartnerMessageThread(partnerId: string, input: z.infer<typeof messageSchema>, actorUserId: string, senderType: "DONOR" | "CENTRE" | "ECDLINK") {
  const thread = await prisma.messageThread.create({ data: { subject: input.subject ?? "Partner conversation", threadType: "General Support", donorOrganisationId: partnerId, centreId: input.centreId, partnershipRequestId: input.partnershipRequestId, messages: { create: { senderUserId: actorUserId, senderType, body: input.body } } }, include: { messages: true } });
  await createAuditLog({ actorUserId, action: "partner.message.send", entityType: "MessageThread", entityId: thread.id, after: thread });
  return thread;
}

export async function generatePartnerReminders(actorUserId: string) {
  const commitments = await prisma.sponsorshipCommitment.findMany({ where: { expectedFulfilmentDate: { lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }, commitmentStatus: { in: ["Proposed", "Confirmed", "Partially Fulfilled"] } }, include: { donor: true }, take: 50 });
  const notifications = await Promise.all(commitments.map((commitment) => prisma.notification.upsert({ where: { id: `partner-commitment-due-${commitment.id}` }, update: { title: "Commitment due soon", body: `${commitment.donor.organisationName ?? commitment.donor.name} commitment ${commitment.referenceNumber} needs follow-up.` }, create: { id: `partner-commitment-due-${commitment.id}`, title: "Commitment due soon", body: `${commitment.donor.organisationName ?? commitment.donor.name} commitment ${commitment.referenceNumber} needs follow-up.` } })));
  await createAuditLog({ actorUserId, action: "partner.reminders.run", entityType: "Notification", metadata: { count: notifications.length } });
  return notifications;
}
