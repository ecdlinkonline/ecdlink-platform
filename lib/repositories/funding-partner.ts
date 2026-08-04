import { prisma } from "@/lib/db/prisma";
import { fundingStatusFromDb } from "@/lib/funding/format";
import type { FundingPartnerAccess, FundingPartnerApplicationRecord, FundingPartnerPortalData } from "@/lib/funding/types";

const activeDecisionStatuses = ["SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUESTED"] as const;

function numberValue(value: { toString(): string } | number | null | undefined) {
  return value == null ? 0 : Number(value);
}

function mapApplication(application: any): FundingPartnerApplicationRecord {
  return {
    id: application.id,
    applicationNumber: application.applicationNumber,
    centreId: application.project.profile.centre.id,
    centreName: application.project.profile.centre.centreName,
    projectTitle: application.project.title,
    fundingOpportunity: application.fundingCall?.title ?? null,
    status: fundingStatusFromDb(application.status),
    requestedAmount: numberValue(application.requestedAmount),
    approvedAmount: application.approvedAmount == null ? null : numberValue(application.approvedAmount),
    submittedAt: application.submittedAt?.toISOString() ?? null,
    decisionDate: application.decisionDate?.toISOString() ?? null,
    reviewedByUserId: application.reviewedByUserId,
    updatedAt: application.updatedAt.toISOString(),
  };
}

export async function getFundingPartnerPortal(access: FundingPartnerAccess): Promise<FundingPartnerPortalData> {
  const organisationWhere = { in: access.fundingOrganisationIds };
  const [organisations, applicationsRaw, callsRaw, assessmentsRaw] = await Promise.all([
    prisma.fundingOrganisation.findMany({
      where: { id: organisationWhere },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.fundingApplication.findMany({
      where: { fundingOrganisationId: organisationWhere },
      select: {
        id: true, applicationNumber: true, status: true, requestedAmount: true, approvedAmount: true,
        submittedAt: true, decisionDate: true, reviewedByUserId: true, updatedAt: true,
        fundingCall: { select: { title: true } },
        project: { select: { title: true, profile: { select: { centre: { select: { id: true, centreName: true } } } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.fundingCall.findMany({
      where: { fundingOrganisationId: organisationWhere },
      select: { id: true, title: true, type: true, status: true, closesAt: true, _count: { select: { applications: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.fundingAssessment.findMany({
      where: { fundingOrganisationId: organisationWhere },
      select: {
        id: true, fundingApplicationId: true, status: true, score: true, totalScore: true, updatedAt: true,
        application: { select: { applicationNumber: true, project: { select: { profile: { select: { centre: { select: { centreName: true } } } } } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const applications = applicationsRaw.map(mapApplication);
  const awaitingReview = applicationsRaw.filter((item) => activeDecisionStatuses.includes(item.status as typeof activeDecisionStatuses[number]));
  const clarificationRequests = applicationsRaw.filter((item) => item.status === "CLARIFICATION_REQUESTED");
  const approved = applicationsRaw.filter((item) => item.status === "APPROVED");
  const rejected = applicationsRaw.filter((item) => item.status === "REJECTED");
  const decided = [...approved, ...rejected];
  const decisionDurations = decided.flatMap((item) => item.submittedAt && item.decisionDate
    ? [(item.decisionDate.getTime() - item.submittedAt.getTime()) / 86_400_000]
    : []);

  return {
    organisationNames: organisations.map((item) => item.name),
    metrics: {
      fundingCalls: callsRaw.length,
      assignedApplications: applications.length,
      awaitingReview: awaitingReview.length,
      approvals: approved.length,
    },
    reports: {
      assignedApplications: applications.length,
      awaitingReview: awaitingReview.length,
      clarificationRequests: clarificationRequests.length,
      approvalRate: decided.length ? Math.round((approved.length / decided.length) * 100) : 0,
      averageDecisionDays: decisionDurations.length ? Math.round(decisionDurations.reduce((sum, days) => sum + days, 0) / decisionDurations.length) : 0,
      fundingCommitted: approved.reduce((sum, item) => sum + numberValue(item.approvedAmount), 0),
    },
    myWork: {
      assignedToMe: applications.filter((item) => item.reviewedByUserId === access.actorUserId && ["Submitted", "In Progress", "Clarification Requested"].includes(item.status)),
      awaitingReview: awaitingReview.map(mapApplication),
      clarificationRequests: clarificationRequests.map(mapApplication),
    },
    applications,
    calls: callsRaw.map((item) => ({ id: item.id, title: item.title, type: item.type, status: item.status, closesAt: item.closesAt?.toISOString() ?? null, applicationCount: item._count.applications })),
    assessments: assessmentsRaw.map((item) => ({ id: item.id, applicationId: item.fundingApplicationId, applicationNumber: item.application?.applicationNumber ?? null, centreName: item.application?.project.profile.centre.centreName ?? null, status: item.status, score: item.totalScore ?? item.score, updatedAt: item.updatedAt.toISOString() })),
  };
}
