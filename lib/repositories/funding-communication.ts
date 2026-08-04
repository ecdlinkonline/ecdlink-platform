import type { FundingCommunicationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const personSelect = { id: true, firstName: true, lastName: true, email: true } as const;
export const fundingPersonName = (person: { firstName: string | null; lastName: string | null; email: string | null } | null) => person ? [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || "Unnamed user" : "Not assigned";

export function createReviewerNote(data: { applicationId: string; authorUserId: string; body: string }) {
  return prisma.fundingReviewerNote.create({ data, include: { author: { select: personSelect } } });
}
export function findReviewerNoteById(id: string) {
  return prisma.fundingReviewerNote.findUnique({ where: { id }, include: { application: true, author: { select: personSelect } } });
}
export function updateReviewerNote(id: string, body: string) {
  return prisma.fundingReviewerNote.update({ where: { id }, data: { body }, include: { author: { select: personSelect } } });
}
export function softDeleteReviewerNote(id: string) {
  return prisma.fundingReviewerNote.update({ where: { id }, data: { deletedAt: new Date() }, include: { author: { select: personSelect } } });
}
export function listReviewerNotes(applicationId: string) {
  return prisma.fundingReviewerNote.findMany({ where: { applicationId, deletedAt: null }, include: { author: { select: personSelect } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
}
export function listReviewerNoteIds(applicationId: string) {
  return prisma.fundingReviewerNote.findMany({ where: { applicationId }, select: { id: true } });
}

export function createCommunication(data: { applicationId: string; type: FundingCommunicationType; authorUserId?: string; recipientUserId?: string; title: string; body: string; metadata?: Prisma.InputJsonValue; sourceEventKey?: string }) {
  const include = { author: { select: personSelect }, recipient: { select: personSelect } } as const;
  return data.sourceEventKey
    ? prisma.fundingCommunication.upsert({ where: { sourceEventKey: data.sourceEventKey }, update: {}, create: data, include })
    : prisma.fundingCommunication.create({ data, include });
}
export function findCommunicationBySourceEventKey(sourceEventKey: string) {
  return prisma.fundingCommunication.findUnique({ where: { sourceEventKey } });
}
export function listCommunications(applicationId: string) {
  return prisma.fundingCommunication.findMany({ where: { applicationId }, include: { author: { select: personSelect }, recipient: { select: personSelect } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}

export type FundingCommunicationTimelineSource = { id: string; type: FundingCommunicationType; title: string; body: string; createdAt: Date; sourceEventKey: string | null };
export type FundingNoteTimelineSource = { id: string; body: string; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
export function projectFundingCommunicationTimeline(communications: FundingCommunicationTimelineSource[], notes: FundingNoteTimelineSource[]) {
  return [
    ...communications.map((item) => ({ id: `communication-${item.id}`, type: "communication" as const, title: item.title, description: item.body, status: item.type, occurredAt: item.createdAt.toISOString(), sourceEventKey: item.sourceEventKey })),
    ...notes.filter((item) => !item.deletedAt).flatMap((item) => [
      { id: `note-${item.id}`, type: "note" as const, title: "Reviewer note added", description: item.body, status: null, occurredAt: item.createdAt.toISOString(), sourceEventKey: null },
      ...(item.updatedAt.getTime() !== item.createdAt.getTime() ? [{ id: `note-${item.id}-updated`, type: "note" as const, title: "Reviewer note updated", description: item.body, status: null, occurredAt: item.updatedAt.toISOString(), sourceEventKey: null }] : []),
    ]),
  ];
}
