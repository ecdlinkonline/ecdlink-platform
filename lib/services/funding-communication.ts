import type { FundingCommunicationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { publishFundingNotification } from "@/lib/notifications";
import { createAuditLog } from "@/lib/repositories/audit-logs";
import * as repository from "@/lib/repositories/funding-communication";
import { getCurrentFundingApplication } from "@/lib/repositories/funding";

export class FundingCommunicationServiceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function canAccessFundingApplication(actor: { status: string; role: string; fundingOrganisationIds: string[] } | null, fundingOrganisationId: string | null) {
  return Boolean(actor && actor.status === "ACTIVE" && (actor.role === "SUPER_ADMIN" || (actor.role === "FUNDING_ORGANISATION" && fundingOrganisationId && actor.fundingOrganisationIds.includes(fundingOrganisationId))));
}

async function requireApplicationAccess(applicationId: string, actorUserId: string) {
  const [application, actor] = await Promise.all([
    prisma.fundingApplication.findUnique({
      where: { id: applicationId },
      include: { project: { include: { profile: { include: { centre: { include: { users: { where: { status: "ACTIVE", user: { status: "ACTIVE" } }, include: { user: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } } } } } } },
    }),
    prisma.user.findUnique({ where: { id: actorUserId }, include: { fundingUsers: { select: { fundingOrganisationId: true } } } }),
  ]);
  if (!application) throw new FundingCommunicationServiceError("Funding application was not found.", 404);
  if (!actor || !canAccessFundingApplication({ status: actor.status, role: actor.role, fundingOrganisationIds: actor.fundingUsers.map((membership) => membership.fundingOrganisationId) }, application.fundingOrganisationId)) throw new FundingCommunicationServiceError("You can only access applications belonging to your funding organisation.", 403);
  return { application, actor };
}

async function resolveRecipient(application: Awaited<ReturnType<typeof requireApplicationAccess>>["application"]) {
  const creator = application.createdByUserId ? await prisma.user.findFirst({ where: { id: application.createdByUserId, status: "ACTIVE" }, select: { id: true } }) : null;
  if (creator) return creator.id;
  return application.project.profile.centre.users.find((item) => item.isPrimary)?.userId ?? application.project.profile.centre.users[0]?.userId;
}

const noteDto = (note: Awaited<ReturnType<typeof repository.createReviewerNote>>, actorUserId: string, superAdmin: boolean) => ({
  id: note.id, applicationId: note.applicationId, authorUserId: note.authorUserId, author: repository.fundingPersonName(note.author), body: note.body,
  createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString(), canEdit: superAdmin || note.authorUserId === actorUserId, canDelete: superAdmin || note.authorUserId === actorUserId,
});
const communicationDto = (item: Awaited<ReturnType<typeof repository.createCommunication>>) => ({
  id: item.id, applicationId: item.applicationId, type: item.type, title: item.title, body: item.body, author: repository.fundingPersonName(item.author), recipient: repository.fundingPersonName(item.recipient), createdAt: item.createdAt.toISOString(), metadata: item.metadata,
});

export async function listFundingReviewerNotes(applicationId: string, actorUserId: string) {
  const { actor } = await requireApplicationAccess(applicationId, actorUserId);
  return (await repository.listReviewerNotes(applicationId)).map((note) => noteDto(note, actorUserId, actor.role === "SUPER_ADMIN"));
}
export async function createFundingReviewerNote(applicationId: string, body: string, actorUserId: string) {
  const { actor } = await requireApplicationAccess(applicationId, actorUserId);
  const note = await repository.createReviewerNote({ applicationId, authorUserId: actorUserId, body });
  await createAuditLog({ actorUserId, action: "funding.note.created", entityType: "FundingReviewerNote", entityId: note.id, after: note, metadata: { applicationId } });
  return noteDto(note, actorUserId, actor.role === "SUPER_ADMIN");
}
export async function updateFundingReviewerNote(noteId: string, body: string, actorUserId: string) {
  const before = await repository.findReviewerNoteById(noteId);
  if (!before || before.deletedAt) throw new FundingCommunicationServiceError("Reviewer note was not found.", 404);
  const { actor } = await requireApplicationAccess(before.applicationId, actorUserId);
  if (actor.role !== "SUPER_ADMIN" && before.authorUserId !== actorUserId) throw new FundingCommunicationServiceError("You can only edit your own reviewer notes.", 403);
  const after = await repository.updateReviewerNote(noteId, body);
  await createAuditLog({ actorUserId, action: "funding.note.updated", entityType: "FundingReviewerNote", entityId: noteId, before, after, metadata: { applicationId: before.applicationId } });
  return noteDto(after, actorUserId, actor.role === "SUPER_ADMIN");
}
export async function deleteFundingReviewerNote(noteId: string, actorUserId: string) {
  const before = await repository.findReviewerNoteById(noteId);
  if (!before || before.deletedAt) throw new FundingCommunicationServiceError("Reviewer note was not found.", 404);
  const { actor } = await requireApplicationAccess(before.applicationId, actorUserId);
  if (actor.role !== "SUPER_ADMIN" && before.authorUserId !== actorUserId) throw new FundingCommunicationServiceError("You can only delete your own reviewer notes.", 403);
  const after = await repository.softDeleteReviewerNote(noteId);
  await createAuditLog({ actorUserId, action: "funding.note.deleted", entityType: "FundingReviewerNote", entityId: noteId, before, after, metadata: { applicationId: before.applicationId } });
  return { deleted: true };
}
export async function listFundingCommunications(applicationId: string, actorUserId: string) {
  await requireApplicationAccess(applicationId, actorUserId);
  return (await repository.listCommunications(applicationId)).map(communicationDto);
}

type WorkflowCommunicationInput = { applicationId: string; type: Exclude<FundingCommunicationType, "MANUAL" | "EMAIL">; actorUserId: string; title: string; body: string; sourceEventKey: string; documentId?: string; metadata?: Prisma.InputJsonValue };
export async function recordFundingWorkflowCommunication(input: WorkflowCommunicationInput) {
  if (await repository.findCommunicationBySourceEventKey(input.sourceEventKey)) return null;
  const { application } = await requireApplicationAccess(input.applicationId, input.actorUserId);
  const recipientUserId = await resolveRecipient(application);
  const communication = await repository.createCommunication({ ...input, recipientUserId, authorUserId: input.actorUserId });
  await createAuditLog({ actorUserId: input.actorUserId, action: "funding.communication.created", entityType: "FundingCommunication", entityId: communication.id, after: communication, metadata: { applicationId: input.applicationId, type: input.type, sourceEventKey: input.sourceEventKey } });
  const notificationType = input.type === "CLARIFICATION_REQUESTED" ? "FUNDING_APPLICATION_CLARIFICATION_REQUESTED" : input.type === "APPLICATION_APPROVED" ? "FUNDING_APPLICATION_APPROVED" : input.type === "APPLICATION_REJECTED" ? "FUNDING_APPLICATION_REJECTED" : input.type === "DOCUMENT_VERIFIED" ? "FUNDING_DOCUMENT_VERIFIED" : "FUNDING_DOCUMENT_RESUBMISSION_REQUESTED";
  if (notificationType.startsWith("FUNDING_DOCUMENT_")) await publishFundingNotification({ type: notificationType as "FUNDING_DOCUMENT_VERIFIED" | "FUNDING_DOCUMENT_RESUBMISSION_REQUESTED", documentId: input.documentId!, actorUserId: input.actorUserId });
  else await publishFundingNotification({ type: notificationType as "FUNDING_APPLICATION_CLARIFICATION_REQUESTED" | "FUNDING_APPLICATION_APPROVED" | "FUNDING_APPLICATION_REJECTED", applicationId: input.applicationId, actorUserId: input.actorUserId });
  return communicationDto(communication);
}

export async function createManualFundingCommunication(applicationId: string, input: { title: string; body: string }, actorUserId: string) {
  const { application } = await requireApplicationAccess(applicationId, actorUserId);
  const communication = await repository.createCommunication({ applicationId, type: "MANUAL", authorUserId: actorUserId, recipientUserId: await resolveRecipient(application), title: input.title, body: input.body });
  await createAuditLog({ actorUserId, action: "funding.communication.created", entityType: "FundingCommunication", entityId: communication.id, after: communication, metadata: { applicationId, type: "MANUAL" } });
  await publishFundingNotification({ type: "FUNDING_MANUAL_COMMUNICATION", applicationId, actorUserId });
  return communicationDto(communication);
}

export async function recordFundingDocumentWorkflowCommunication(input: { documentId: string; actorUserId: string; type: "DOCUMENT_VERIFIED" | "DOCUMENT_RESUBMISSION"; title: string; body: string; sourceEventKey: string; metadata?: Prisma.InputJsonValue }) {
  const document = await prisma.fundingSupportingDocument.findUnique({ where: { id: input.documentId }, select: { profile: { select: { projects: { select: { id: true, applications: { select: { id: true, updatedAt: true } } } } } } } });
  if (!document) throw new FundingCommunicationServiceError("Funding document was not found.", 404);
  const current = getCurrentFundingApplication(document.profile);
  if (!current) return null;
  return recordFundingWorkflowCommunication({ ...input, applicationId: current.application.id });
}
