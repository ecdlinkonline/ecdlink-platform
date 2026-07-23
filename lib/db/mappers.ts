import type { Prisma } from "@prisma/client";
import type {
  CentreActivity,
  CentreNote,
  CentrePhoto,
  EcdCentre,
} from "@/lib/centres/types";

export const registrationToDb = {
  Registered: "REGISTERED",
  "In Progress": "IN_PROGRESS",
  "Not Registered": "NOT_REGISTERED",
} as const;

export const membershipToDb = {
  Active: "ACTIVE",
  Pending: "PENDING",
  Expired: "EXPIRED",
  Overdue: "OVERDUE",
} as const;

export const participationToDb = {
  Active: "ACTIVE",
  Inactive: "INACTIVE",
  Pending: "PENDING",
} as const;

export const complianceToDb = {
  Compliant: "COMPLIANT",
  Attention: "ATTENTION",
  "Action Required": "ACTION_REQUIRED",
} as const;

export const readinessToDb = {
  Ready: "READY",
  "In Progress": "IN_PROGRESS",
  "Needs Attention": "NEEDS_ATTENTION",
} as const;

export const activityToDb = {
  profile: "PROFILE",
  membership: "MEMBERSHIP",
  procurement: "PROCUREMENT",
  compliance: "COMPLIANCE",
  funding: "FUNDING",
  note: "NOTE",
} as const;

const registrationFromDb = {
  REGISTERED: "Registered",
  IN_PROGRESS: "In Progress",
  NOT_REGISTERED: "Not Registered",
} as const;

const membershipFromDb = {
  ACTIVE: "Active",
  PENDING: "Pending",
  EXPIRED: "Expired",
  OVERDUE: "Expired",
  CANCELLED: "Expired",
} as const;

const participationFromDb = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PENDING: "Pending",
} as const;

const complianceFromDb = {
  COMPLIANT: "Compliant",
  ATTENTION: "Attention",
  ACTION_REQUIRED: "Action Required",
} as const;

const readinessFromDb = {
  READY: "Ready",
  IN_PROGRESS: "In Progress",
  NEEDS_ATTENTION: "Needs Attention",
} as const;

const activityFromDb = {
  PROFILE: "profile",
  MEMBERSHIP: "membership",
  PROCUREMENT: "procurement",
  COMPLIANCE: "compliance",
  FUNDING: "funding",
  NOTE: "note",
} as const;

type CentreWithRelations = Prisma.EcdCentreGetPayload<{
  include: {
    photos: true;
    centreNotes: true;
    activities: true;
  };
}>;

export function mapDbCentreToDto(
  centre: CentreWithRelations
): EcdCentre {
  const photos: CentrePhoto[] = centre.photos.map(
    (photo) => ({
      id: photo.id,
      title: photo.title,
      tone: photo.tone ?? "bg-blue-100",
      uploadedAt: photo.uploadedAt
        .toISOString()
        .slice(0, 10),
    })
  );

  const notes: CentreNote[] = centre.centreNotes.map(
    (note) => ({
      id: note.id,
      author: note.author,
      body: note.body,
      createdAt: note.createdAt
        .toISOString()
        .slice(0, 10),
    })
  );

  const activityTimeline: CentreActivity[] =
    centre.activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      createdAt: activity.createdAt
        .toISOString()
        .slice(0, 10),
      type: activityFromDb[activity.type],
    }));

  return {
    id: centre.slug,
    centreName: centre.centreName,
    registrationStatus:
      registrationFromDb[centre.registrationStatus],
    npoNumber: centre.npoNumber ?? "",
    dbeRegistrationStatus:
      centre.dbeRegistrationStatus ??
      centre.partialCareStatus ??
      "",
    physicalAddress: centre.physicalAddress ?? "",
    area: centre.area ?? "",
    region: centre.region ?? "",
    contactPerson: centre.contactPerson ?? "",
    phoneNumber: centre.phone ?? "",
    emailAddress: centre.email ?? "",
    numberOfChildren: centre.numberOfChildren ?? 0,
    numberOfStaff: centre.numberOfStaff ?? 0,
    principalName: centre.principalName ?? "",
    membershipStatus:
      membershipFromDb[centre.membershipStatus],
    procurementStatus:
      participationFromDb[centre.procurementStatus],
    complianceStatus:
      complianceFromDb[centre.complianceStatus],
    fundingReadinessStatus:
      readinessFromDb[
        centre.fundingReadinessStatus
      ],
    centrePhotos: photos,
    notes,
    activityTimeline,
    createdDate: centre.createdAt
      .toISOString()
      .slice(0, 10),
    lastUpdatedDate: centre.updatedAt
      .toISOString()
      .slice(0, 10),
  };
}