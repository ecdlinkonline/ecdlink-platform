import { prisma } from "@/lib/db/prisma";
import { fundingOpportunityTypes, fundingStatusFromDb } from "@/lib/funding/format";
import type { FundingFilters, FundingReadinessLiveRecord, FundingReadinessRecord, FundingReport } from "@/lib/funding/types";

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value ?? 0);
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function matchesReadinessBand(score: number, band?: FundingFilters["readinessBand"]) {
  return !band || band === "All" || (band === "80+" && score >= 80) || (band === "50-79" && score >= 50 && score < 80) || (band === "Below 50" && score < 50);
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
    beneficiaries: number | null;
    status: string;
    objective: string | null;
    updatedAt: Date;
    applications?: Array<{
      id: string;
      status: string;
      requestedAmount: unknown;
      approvedAmount: unknown;
      submittedAt: Date | null;
      decidedAt: Date | null;
      decisionDate: Date | null;
      updatedAt: Date;
      fundingOrganisation: { name: string; type: string | null } | null;
      fundingCall: {
        title: string;
        type: string | null;
        organisation: { name: string; type: string | null };
      } | null;
    }>;
  }>;
  checklistItems?: Array<{ id: string; label: string; status: string; note: string | null; category: string }>;
  supportingDocuments?: Array<{ id: string; label: string; status: string; note: string | null }>;
  reminders?: Array<{ title: string; body: string; dueAt: Date | null; status: string }>;
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

async function fundingProfileQuery() {
  return prisma.fundingProfile.findMany({
    include: {
      centre: { select: { id: true, slug: true, centreName: true, region: true, province: true, area: true, contactPerson: true } },
      projects: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          opportunityType: true,
          funderType: true,
          requestedAmount: true,
          beneficiaries: true,
          status: true,
          objective: true,
          updatedAt: true,
          applications: {
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              status: true,
              requestedAmount: true,
              approvedAmount: true,
              submittedAt: true,
              decidedAt: true,
              decisionDate: true,
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
      checklistItems: { orderBy: { displayOrder: "asc" }, select: { id: true, label: true, status: true, note: true, category: true } },
      supportingDocuments: { orderBy: { createdAt: "asc" }, select: { id: true, label: true, status: true, note: true } },
      reminders: { orderBy: { createdAt: "desc" }, take: 5, select: { title: true, body: true, dueAt: true, status: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function listFundingReadinessFromDb(filters: FundingFilters = {}) {
  const profiles = (await fundingProfileQuery()) as FundingProfileWithRelations[];
  const records = profiles.map(mapProfile);
  const query = filters.query?.trim().toLowerCase() ?? "";
  return records.filter((record) => {
    const searchable = [record.centreName, record.region, record.area, record.contactPerson, record.status, record.funderType, ...record.projectProfiles.map((project) => `${project.title} ${project.funderType}`)].join(" ").toLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (!filters.region || filters.region === "All" || record.region === filters.region) &&
      (!filters.status || filters.status === "All" || record.status === filters.status) &&
      (!filters.funderType || filters.funderType === "All" || record.funderType === filters.funderType) &&
      matchesReadinessBand(record.readinessScore, filters.readinessBand)
    );
  });
}

export async function getFundingReadinessByCentreIdFromDb(centreId: string) {
  const profile = await prisma.fundingProfile.findFirst({
    where: { OR: [{ centreId }, { centre: { slug: centreId } }] },
    include: {
      centre: { select: { id: true, slug: true, centreName: true, region: true, province: true, area: true, contactPerson: true } },
      projects: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          opportunityType: true,
          funderType: true,
          requestedAmount: true,
          beneficiaries: true,
          status: true,
          objective: true,
          updatedAt: true,
          applications: {
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              status: true,
              requestedAmount: true,
              approvedAmount: true,
              submittedAt: true,
              decidedAt: true,
              decisionDate: true,
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
      checklistItems: { orderBy: { displayOrder: "asc" }, select: { id: true, label: true, status: true, note: true, category: true } },
      supportingDocuments: { orderBy: { createdAt: "asc" }, select: { id: true, label: true, status: true, note: true } },
      reminders: { orderBy: { createdAt: "desc" }, take: 5, select: { title: true, body: true, dueAt: true, status: true } }
    }
  });
  return profile ? mapProfile(profile as FundingProfileWithRelations) : null;
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
