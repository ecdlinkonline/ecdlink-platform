import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { fundingOpportunityTypes, fundingStatusFromDb } from "@/lib/funding/format";
import type { FundingFilters, FundingReadinessLiveRecord, FundingReadinessRecord, FundingReport, FundingReviewTimelineItem, FundingReviewWorkspaceData } from "@/lib/funding/types";

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value ?? 0);
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function buildFundingProfileWhere(filters: FundingFilters): Prisma.FundingProfileWhereInput {
  const query = filters.query?.trim();
  const region = filters.region && filters.region !== "All" ? filters.region : undefined;
  const funderType = filters.funderType && filters.funderType !== "All" ? filters.funderType : undefined;

  // Search can be expressed safely in Prisma because every searchable value is stored on a related database record.
  const searchFilter: Prisma.FundingProfileWhereInput | undefined = query
    ? {
        OR: [
          { centre: { centreName: { contains: query, mode: "insensitive" } } },
          { projects: { some: { title: { contains: query, mode: "insensitive" } } } },
          { projects: { some: { applications: { some: { fundingOrganisation: { is: { name: { contains: query, mode: "insensitive" } } } } } } } },
          { projects: { some: { applications: { some: { fundingCall: { is: { title: { contains: query, mode: "insensitive" } } } } } } } },
        ],
      }
    : undefined;

  // Region is safe in Prisma; the second branch mirrors the mapper's province fallback when region is absent.
  const regionFilter: Prisma.FundingProfileWhereInput | undefined = region
    ? region === "Unassigned"
      ? { centre: { region: null, province: null } }
      : {
          OR: [
            { centre: { region } },
            { centre: { region: null, province: region } },
          ],
        }
    : undefined;

  // Funding type is safe in Prisma because matching any related project or application preserves one profile row.
  const fundingTypeFilter: Prisma.FundingProfileWhereInput | undefined = funderType
    ? {
        projects: {
          some: {
            OR: [
              { funderType },
              { opportunityType: funderType },
              { applications: { some: { fundingOrganisation: { is: { type: funderType } } } } },
              { applications: { some: { fundingCall: { is: { type: funderType } } } } },
            ],
          },
        },
      }
    : undefined;

  // Readiness bands map directly to numeric comparisons on FundingProfile.readinessScore.
  const readinessFilter: Prisma.FundingProfileWhereInput | undefined =
    filters.readinessBand === "80+"
      ? { readinessScore: { gte: 80 } }
      : filters.readinessBand === "50-79"
        ? { readinessScore: { gte: 50, lt: 80 } }
        : filters.readinessBand === "Below 50"
          ? { readinessScore: { lt: 50 } }
          : undefined;

  return {
    AND: [searchFilter, regionFilter, fundingTypeFilter, readinessFilter].filter(
      (filter): filter is Prisma.FundingProfileWhereInput => Boolean(filter)
    ),
  };
}

type FundingProfileWithRelations = {
  id: string;
  centreId: string;
  readinessScore: number;
  status: string;
  readinessStatus: string;
  proposalReady: boolean;
  budgetReady: boolean;
  adminNotes: string | null;
  recommendedActions: string[];
  lastAssessmentDate: Date | null;
  updatedAt: Date;
  centre?: {
    id: string;
    slug: string;
    centreName: string;
    region: string | null;
    province: string | null;
    area: string | null;
    contactPerson: string | null;
  };
  projects?: Array<{
    id: string;
    title: string;
    opportunityType: string | null;
    funderType: string | null;
    requestedAmount: unknown;
    amountSecured: unknown;
    fundingGap: unknown;
    beneficiaries: number | null;
    status: string;
    objective: string | null;
    approvedAt: Date | null;
    updatedAt: Date;
    applications?: Array<{
      id: string;
      applicationNumber: string;
      status: string;
      requestedAmount: unknown;
      approvedAmount: unknown;
      submittedAt: Date | null;
      decidedAt: Date | null;
      decisionDate: Date | null;
      submissionMethod: string | null;
      externalReference: string | null;
      rejectionReason: string | null;
      notes: string | null;
      reviewedByUserId: string | null;
      updatedAt: Date;
      fundingOrganisation: { name: string; type: string | null } | null;
      fundingCall: {
        title: string;
        type: string | null;
        organisation: { name: string; type: string | null };
      } | null;
    }>;
  }>;
  checklistItems?: Array<{ id: string; label: string; status: string; note: string | null; category: string; required: boolean; completedAt: Date | null }>;
  supportingDocuments?: Array<{ id: string; label: string; documentType: string; status: string; note: string | null; fileId: string | null; uploadedAt: Date | null; verifiedAt: Date | null; updatedAt: Date }>;
  reminders?: Array<{ id: string; title: string; body: string; dueAt: Date | null; status: string; createdAt: Date }>;
};

type CurrentFundingApplication = {
  application: NonNullable<NonNullable<FundingProfileWithRelations["projects"]>[number]["applications"]>[number];
  project: NonNullable<FundingProfileWithRelations["projects"]>[number];
};

function getCurrentFundingApplication(profile: FundingProfileWithRelations): CurrentFundingApplication | null {
  let current: CurrentFundingApplication | null = null;

  for (const project of profile.projects ?? []) {
    for (const application of project.applications ?? []) {
      if (!current || application.updatedAt > current.application.updatedAt) {
        current = { application, project };
      }
    }
  }

  return current;
}

export function buildFundingTimeline(profile: FundingProfileWithRelations): FundingReviewTimelineItem[] {
  const timeline: FundingReviewTimelineItem[] = [
    {
      id: `profile-${profile.id}-updated`,
      type: "profile",
      title: "Funding profile updated",
      description: "The centre funding-readiness profile was updated.",
      status: profile.readinessStatus,
      occurredAt: profile.updatedAt.toISOString(),
    },
  ];

  if (profile.lastAssessmentDate) {
    timeline.push({
      id: `profile-${profile.id}-assessed`,
      type: "profile",
      title: "Readiness assessed",
      description: `Readiness score recorded at ${profile.readinessScore}%.`,
      status: profile.status,
      occurredAt: profile.lastAssessmentDate.toISOString(),
    });
  }

  for (const project of profile.projects ?? []) {
    timeline.push({
      id: `project-${project.id}-updated`,
      type: "project",
      title: "Project updated",
      description: project.title,
      status: project.status,
      occurredAt: project.updatedAt.toISOString(),
    });

    if (project.approvedAt) {
      timeline.push({
        id: `project-${project.id}-approved`,
        type: "project",
        title: "Project approved for partner review",
        description: project.title,
        status: "APPROVED",
        occurredAt: project.approvedAt.toISOString(),
      });
    }

    for (const application of project.applications ?? []) {
      if (application.submittedAt) {
        timeline.push({
          id: `application-${application.id}-submitted`,
          type: "application",
          title: "Application submitted",
          description: `${application.applicationNumber} · ${project.title}`,
          status: application.status,
          occurredAt: application.submittedAt.toISOString(),
        });
      }

      const decisionDate = application.decidedAt ?? application.decisionDate;
      if (decisionDate) {
        timeline.push({
          id: `application-${application.id}-decided`,
          type: "application",
          title: "Application decision recorded",
          description: `${application.applicationNumber} · ${project.title}`,
          status: application.status,
          occurredAt: decisionDate.toISOString(),
        });
      }
    }
  }

  for (const document of profile.supportingDocuments ?? []) {
    if (document.uploadedAt) {
      timeline.push({
        id: `document-${document.id}-uploaded`,
        type: "document",
        title: "Supporting document uploaded",
        description: document.label,
        status: document.status,
        occurredAt: document.uploadedAt.toISOString(),
      });
    }
    if (document.verifiedAt) {
      timeline.push({
        id: `document-${document.id}-verified`,
        type: "document",
        title: "Supporting document verified",
        description: document.label,
        status: document.status,
        occurredAt: document.verifiedAt.toISOString(),
      });
    }
  }

  for (const reminder of profile.reminders ?? []) {
    timeline.push({
      id: `reminder-${reminder.id}-created`,
      type: "reminder",
      title: reminder.title,
      description: reminder.body,
      status: reminder.status,
      occurredAt: reminder.createdAt.toISOString(),
    });
  }

  return timeline.sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  );
}

function mapProfile(profile: FundingProfileWithRelations): FundingReadinessLiveRecord {
  const centre = profile.centre;
  const applicationChecklist = (profile.checklistItems ?? [])
    .filter((item) => item.category === "Application")
    .map((item) => ({
      id: item.id,
      label: item.label,
      complete: item.status === "COMPLETE" || item.status === "WAIVED",
      note: item.note ?? (item.status === "COMPLETE" ? "Ready for funding pack." : "Needs follow-up before submission.")
    }));
  const supportingDocuments = (profile.supportingDocuments ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    complete: item.status === "COMPLETE" || item.status === "WAIVED",
    note: item.note ?? (item.status === "COMPLETE" ? "Document ready." : "Document still required.")
  }));
  const projects = (profile.projects ?? []).map((project) => ({
    id: project.id,
    title: project.title,
    opportunityType: (project.opportunityType ?? "Donor funding") as FundingReadinessRecord["funderType"],
    funderType: (project.funderType ?? project.opportunityType ?? "Donor funding") as FundingReadinessRecord["funderType"],
    requestedAmount: numberValue(project.requestedAmount),
    beneficiaries: project.beneficiaries ?? 0,
    status: fundingStatusFromDb(project.status),
    objective: project.objective ?? "Prepare project profile for funding matching and submission."
  }));
  const currentApplication = getCurrentFundingApplication(profile);
  const applications = (profile.projects ?? []).flatMap((project) => project.applications ?? []);
  const applicationStatus = currentApplication
    ? fundingStatusFromDb(currentApplication.application.status)
    : fundingStatusFromDb(profile.status);
  const approvedAmount = applications
    .filter((application) => application.status === "APPROVED")
    .reduce((sum, application) => sum + numberValue(application.approvedAmount), 0);
  const fundingOrganisation =
    currentApplication?.application.fundingOrganisation?.name ??
    currentApplication?.application.fundingCall?.organisation.name ??
    null;
  const fundingOpportunity =
    currentApplication?.application.fundingCall?.title ??
    currentApplication?.project.title ??
    currentApplication?.project.opportunityType ??
    null;
  const lastUpdatedAt = [
    profile.updatedAt,
    ...(profile.projects ?? []).map((project) => project.updatedAt),
    ...applications.map((application) => application.updatedAt),
  ].reduce((latest, value) => value > latest ? value : latest, profile.updatedAt);

  return {
    id: profile.id,
    centreId: centre?.slug ?? profile.centreId,
    centreName: centre?.centreName ?? "Unknown centre",
    region: centre?.region ?? centre?.province ?? "Unassigned",
    area: centre?.area ?? "Unassigned",
    contactPerson: centre?.contactPerson ?? "Centre contact",
    readinessScore: profile.readinessScore,
    status: applicationStatus,
    funderType: (projects[0]?.funderType ?? "Donor funding") as FundingReadinessRecord["funderType"],
    projectProfiles: projects,
    applicationChecklist,
    supportingDocuments,
    applicationTracker: [
      { stage: "Readiness review", status: fundingStatusFromDb(profile.status), date: dateValue(profile.lastAssessmentDate) },
      { stage: "Application pack", status: profile.proposalReady && profile.budgetReady ? "Ready" : "In Progress", date: dateValue(profile.updatedAt) },
      {
        stage: "Funder decision",
        status: applicationStatus,
        date: dateValue(
          currentApplication?.application.decidedAt ??
          currentApplication?.application.decisionDate ??
          currentApplication?.application.updatedAt
        )
      }
    ],
    adminNotes: profile.adminNotes?.split("\n").filter(Boolean) ?? profile.recommendedActions ?? [],
    lastUpdatedAt: lastUpdatedAt.toISOString(),
    readinessStatus: profile.readinessStatus,
    applicationStatus,
    approvedAmount,
    fundingOrganisation,
    fundingOpportunity
  };
}

function mapFundingReviewWorkspace(profile: FundingProfileWithRelations): FundingReviewWorkspaceData {
  const summary = mapProfile(profile);
  const currentApplication = getCurrentFundingApplication(profile);
  const applications = (profile.projects ?? []).flatMap((project) =>
    (project.applications ?? []).map((application) => ({
      id: application.id,
      applicationNumber: application.applicationNumber,
      projectId: project.id,
      projectTitle: project.title,
      status: fundingStatusFromDb(application.status),
      requestedAmount: numberValue(application.requestedAmount),
      approvedAmount: application.approvedAmount == null ? null : numberValue(application.approvedAmount),
      fundingOrganisation: application.fundingOrganisation?.name ?? application.fundingCall?.organisation.name ?? null,
      fundingOpportunity: application.fundingCall?.title ?? project.title ?? project.opportunityType ?? null,
      submissionMethod: application.submissionMethod,
      externalReference: application.externalReference,
      submittedAt: application.submittedAt?.toISOString() ?? null,
      decisionDate: (application.decidedAt ?? application.decisionDate)?.toISOString() ?? null,
      rejectionReason: application.rejectionReason,
      notes: application.notes,
      reviewedByUserId: application.reviewedByUserId,
      updatedAt: application.updatedAt.toISOString(),
    }))
  ).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  return {
    summary,
    currentApplicationId: currentApplication?.application.id ?? null,
    applications,
    projects: (profile.projects ?? []).map((project) => ({
      id: project.id,
      title: project.title,
      opportunityType: (project.opportunityType ?? "Donor funding") as FundingReadinessRecord["funderType"],
      funderType: (project.funderType ?? project.opportunityType ?? "Donor funding") as FundingReadinessRecord["funderType"],
      requestedAmount: numberValue(project.requestedAmount),
      amountSecured: numberValue(project.amountSecured),
      fundingGap: numberValue(project.fundingGap),
      beneficiaries: project.beneficiaries ?? 0,
      status: fundingStatusFromDb(project.status),
      objective: project.objective ?? "Prepare project profile for funding matching and submission.",
      approvedAt: project.approvedAt?.toISOString() ?? null,
      updatedAt: project.updatedAt.toISOString(),
    })),
    checklistItems: (profile.checklistItems ?? []).map((item) => ({
      id: item.id,
      category: item.category,
      label: item.label,
      status: item.status,
      note: item.note,
      required: item.required,
      completedAt: item.completedAt?.toISOString() ?? null,
    })),
    supportingDocuments: (profile.supportingDocuments ?? []).map((document) => ({
      id: document.id,
      label: document.label,
      documentType: document.documentType,
      status: document.status,
      note: document.note,
      fileId: document.fileId,
      uploadedAt: document.uploadedAt?.toISOString() ?? null,
      verifiedAt: document.verifiedAt?.toISOString() ?? null,
      updatedAt: document.updatedAt.toISOString(),
    })),
    reminders: (profile.reminders ?? []).map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      body: reminder.body,
      status: reminder.status,
      dueAt: reminder.dueAt?.toISOString() ?? null,
      createdAt: reminder.createdAt.toISOString(),
    })),
    timeline: buildFundingTimeline(profile),
  };
}

const fundingProfileRelations = {
  centre: { select: { id: true, slug: true, centreName: true, region: true, province: true, area: true, contactPerson: true } },
  projects: {
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      opportunityType: true,
      funderType: true,
      requestedAmount: true,
      amountSecured: true,
      fundingGap: true,
      beneficiaries: true,
      status: true,
      objective: true,
      approvedAt: true,
      updatedAt: true,
      applications: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          applicationNumber: true,
          status: true,
          requestedAmount: true,
          approvedAmount: true,
          submissionMethod: true,
          externalReference: true,
          submittedAt: true,
          decidedAt: true,
          decisionDate: true,
          rejectionReason: true,
          notes: true,
          reviewedByUserId: true,
          updatedAt: true,
          fundingOrganisation: { select: { name: true, type: true } },
          fundingCall: {
            select: {
              title: true,
              type: true,
              organisation: { select: { name: true, type: true } }
            }
          }
        }
      }
    }
  },
  checklistItems: { orderBy: { displayOrder: "asc" }, select: { id: true, label: true, status: true, note: true, category: true, required: true, completedAt: true } },
  supportingDocuments: { orderBy: { createdAt: "asc" }, select: { id: true, label: true, documentType: true, status: true, note: true, fileId: true, uploadedAt: true, verifiedAt: true, updatedAt: true } },
  reminders: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, body: true, dueAt: true, status: true, createdAt: true } }
} satisfies Prisma.FundingProfileInclude;

async function fundingProfileQuery(filters: FundingFilters = {}) {
  return prisma.fundingProfile.findMany({
    where: buildFundingProfileWhere(filters),
    include: fundingProfileRelations,
    orderBy: { updatedAt: "desc" }
  });
}

export async function listFundingReadinessFromDb(filters: FundingFilters = {}) {
  const profiles = (await fundingProfileQuery(filters)) as FundingProfileWithRelations[];
  const records = profiles.map(mapProfile);

  // Current status cannot be represented safely by `some` in Prisma: it must describe the newest application,
  // so filter the mapped server result produced by the shared getCurrentFundingApplication helper.
  if (filters.status && filters.status !== "All") {
    return records.filter((record) => record.applicationStatus === filters.status);
  }

  return records;
}

export async function getFundingReadinessByCentreIdFromDb(centreId: string) {
  const profile = await prisma.fundingProfile.findFirst({
    where: { OR: [{ centreId }, { centre: { slug: centreId } }] },
    include: fundingProfileRelations
  });
  return profile ? mapProfile(profile as FundingProfileWithRelations) : null;
}

export async function getFundingReviewWorkspaceFromDb(centreId: string): Promise<FundingReviewWorkspaceData | null> {
  const profile = await prisma.fundingProfile.findFirst({
    where: { OR: [{ centreId }, { centre: { slug: centreId } }] },
    include: fundingProfileRelations
  });
  return profile ? mapFundingReviewWorkspace(profile as FundingProfileWithRelations) : null;
}

export async function getFundingReportsFromDb(): Promise<FundingReport> {
  const records = await listFundingReadinessFromDb();
  const totalRequested = records.reduce((sum, record) => sum + record.projectProfiles.reduce((inner, project) => inner + project.requestedAmount, 0), 0);
  const averageReadiness = records.length ? Math.round(records.reduce((sum, record) => sum + record.readinessScore, 0) / records.length) : 0;
  const statuses = ["Draft", "In Progress", "Ready", "Submitted", "Approved", "Rejected"] as const;
  const regions = Array.from(new Set(records.map((record) => record.region)));

  return {
    totalCentres: records.length,
    readyCount: records.filter((record) => record.status === "Ready").length,
    submittedCount: records.filter((record) => record.status === "Submitted").length,
    approvedCount: records.filter((record) => record.status === "Approved").length,
    rejectedCount: records.filter((record) => record.status === "Rejected").length,
    totalRequested,
    averageReadiness,
    statusBreakdown: statuses.map((status) => ({ label: status, value: records.filter((record) => record.status === status).length })),
    funderTypeBreakdown: fundingOpportunityTypes.map((type) => ({ label: type, value: records.filter((record) => record.funderType === type).length })),
    regionalReadiness: regions.map((region) => {
      const regionalRecords = records.filter((record) => record.region === region);
      return { label: region, value: regionalRecords.length ? Math.round(regionalRecords.reduce((sum, record) => sum + record.readinessScore, 0) / regionalRecords.length) : 0 };
    })
  };
}

export async function listFundingCallsFromDb(filters: { status?: string; type?: string } = {}) {
  return prisma.fundingCall.findMany({
    where: {
      status: filters.status && filters.status !== "All" ? filters.status : undefined,
      type: filters.type && filters.type !== "All" ? filters.type : undefined
    },
    include: { organisation: { select: { id: true, name: true, type: true } } },
    orderBy: [{ featured: "desc" }, { closesAt: "asc" }]
  });
}

export async function getFundingCallFromDb(id: string) {
  return prisma.fundingCall.findUnique({
    where: { id },
    include: {
      organisation: { select: { id: true, name: true, type: true } },
      applications: { include: { project: { include: { profile: { include: { centre: true } } } } } },
      assessments: true
    }
  });
}

export async function getFundingProjectForOwnedCentre(projectId: string, centreIds: string[]) {
  return prisma.fundingProject.findFirst({
    where: { id: projectId, profile: { centreId: { in: centreIds } } },
    include: { profile: true }
  });
}
