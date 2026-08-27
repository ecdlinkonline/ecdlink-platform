import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { GrantReportFiltersInput } from "@/lib/validators/grant-reports";

export function withGrantReportingTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(operation);
}

const partyInclude = {
  where: { removedAt: null },
  orderBy: [{ isPrimary: "desc" as const }, { addedAt: "asc" as const }],
  include: {
    fundingOrganisation: { select: { id: true, name: true } },
    donorOrganisation: { select: { id: true, name: true, organisationName: true } },
  },
};

function partyName(parties: Array<{ fundingOrganisation: { name: string } | null; donorOrganisation: { name: string; organisationName: string | null } | null }>) {
  const party = parties[0];
  return party?.fundingOrganisation?.name ?? party?.donorOrganisation?.organisationName ?? party?.donorOrganisation?.name ?? "Unassigned";
}

function dateValue(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

export function buildGrantReportMetrics(
  activeAwards: number,
  reportsDue: number,
  statusCounts: ReadonlyMap<string, number>,
) {
  return {
    activeAwards,
    reportsDue,
    draftReports: statusCounts.get("DRAFT") ?? 0,
    submittedReports: statusCounts.get("SUBMITTED") ?? 0,
    returnedReports: statusCounts.get("RETURNED") ?? 0,
    approvedReports: statusCounts.get("APPROVED") ?? 0,
  };
}

export function buildGrantReportWhere(filters: GrantReportFiltersInput): Prisma.GrantReportWhereInput {
  const query = filters.query?.trim();
  const organisationFilter = filters.organisationId ? {
    organisations: { some: { removedAt: null, OR: [{ fundingOrganisationId: filters.organisationId }, { donorOrganisationId: filters.organisationId }] } },
  } : undefined;

  return {
    status: filters.status,
    obligation: { type: filters.type },
    award: {
      centreId: filters.centreId,
      ...organisationFilter,
      ...(query ? {
        OR: [
          { awardNumber: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { centre: { centreName: { contains: query, mode: "insensitive" } } },
          { fundingProject: { title: { contains: query, mode: "insensitive" } } },
          { organisations: { some: { OR: [
            { fundingOrganisation: { name: { contains: query, mode: "insensitive" } } },
            { donorOrganisation: { OR: [
              { name: { contains: query, mode: "insensitive" } },
              { organisationName: { contains: query, mode: "insensitive" } },
            ] } },
          ] } } },
        ],
      } : {}),
    },
  };
}

export async function getGrantReportWorkspace(filters: GrantReportFiltersInput = {}) {
  const now = new Date();
  const reportWhere = buildGrantReportWhere(filters);
  const [activeAwards, reportsDue, statusGroups, reports, awards, obligations, centres, fundingOrganisations, donorOrganisations, projects, applications, commitments] = await Promise.all([
    prisma.grantAward.count({ where: { status: "ACTIVE" } }),
    prisma.grantReportingObligation.count({ where: { dueAt: { lte: now }, status: { in: ["PENDING", "OPEN", "OVERDUE"] } } }),
    prisma.grantReport.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.grantReport.findMany({
      where: reportWhere,
      include: {
        obligation: true,
        award: { include: { centre: { select: { id: true, centreName: true } }, fundingProject: { select: { id: true, title: true } }, organisations: partyInclude } },
      },
      orderBy: [{ obligation: { dueAt: "asc" } }, { updatedAt: "desc" }],
      take: 200,
    }),
    prisma.grantAward.findMany({
      include: {
        centre: { select: { id: true, centreName: true } },
        fundingProject: { select: { id: true, title: true } },
        organisations: partyInclude,
        tranches: { select: { id: true, trancheNumber: true, title: true }, orderBy: { trancheNumber: "asc" } },
        _count: { select: { tranches: true, obligations: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
    prisma.grantReportingObligation.findMany({
      include: { award: { include: { centre: { select: { centreName: true } }, organisations: partyInclude } }, tranche: { select: { id: true, trancheNumber: true, title: true } }, report: { select: { id: true, status: true, currentVersionNumber: true } } },
      orderBy: [{ dueAt: "asc" }],
      take: 200,
    }),
    prisma.ecdCentre.findMany({ where: { archivedAt: null }, select: { id: true, centreName: true }, orderBy: { centreName: "asc" }, take: 500 }),
    prisma.fundingOrganisation.findMany({ where: { status: "Active" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 }),
    prisma.donorOrganisation.findMany({ where: { archivedAt: null }, select: { id: true, name: true, organisationName: true }, orderBy: { name: "asc" }, take: 200 }),
    prisma.fundingProject.findMany({ select: { id: true, title: true, requestedAmount: true, profile: { select: { centreId: true, centre: { select: { centreName: true } } } } }, orderBy: { title: "asc" }, take: 500 }),
    prisma.fundingApplication.findMany({
      where: { status: "APPROVED", grantAward: null },
      select: {
        id: true,
        applicationNumber: true,
        approvedAmount: true,
        fundingOrganisationId: true,
        projectId: true,
        project: {
          select: {
            title: true,
            profile: { select: { centreId: true, centre: { select: { centreName: true } } } },
          },
        },
        fundingOrganisation: { select: { name: true } },
      },
      orderBy: { decidedAt: "desc" },
      take: 200,
    }),
    prisma.sponsorshipCommitment.findMany({ where: { commitmentStatus: { in: ["Confirmed", "Partially Fulfilled", "Fulfilled"] }, grantAward: null }, select: { id: true, referenceNumber: true, committedAmount: true, donorOrganisationId: true, centreId: true, commitmentStatus: true, centre: { select: { centreName: true } }, donor: { select: { name: true, organisationName: true } }, project: { select: { fundingProjectId: true, title: true, fundingProject: { select: { title: true } } } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);

  const counts = new Map(statusGroups.map((group) => [group.status, group._count._all]));
  return {
    metrics: buildGrantReportMetrics(activeAwards, reportsDue, counts),
    reports: reports.map((report) => ({
      id: report.id,
      title: report.obligation.title,
      centre: report.award.centre.centreName,
      funder: partyName(report.award.organisations),
      project: report.award.fundingProject.title,
      type: report.obligation.type,
      reportingPeriodStart: dateValue(report.obligation.reportingPeriodStart),
      reportingPeriodEnd: dateValue(report.obligation.reportingPeriodEnd),
      dueAt: report.obligation.dueAt.toISOString(),
      status: report.status,
      version: report.currentVersionNumber,
    })),
    awards: awards.map((award) => ({
      id: award.id,
      awardNumber: award.awardNumber,
      centre: award.centre.centreName,
      project: award.fundingProject.title,
      leadOrganisation: partyName(award.organisations),
      awardedAmount: Number(award.awardedAmount),
      currency: award.currency,
      startDate: award.startDate.toISOString(),
      endDate: dateValue(award.endDate),
      status: award.status,
      trancheCount: award._count.tranches,
      obligationCount: award._count.obligations,
    })),
    obligations: obligations.map((obligation) => ({
      id: obligation.id,
      awardId: obligation.grantAwardId,
      awardNumber: obligation.award.awardNumber,
      title: obligation.title,
      centre: obligation.award.centre.centreName,
      funder: partyName(obligation.award.organisations),
      type: obligation.type,
      basis: obligation.basis,
      dueAt: obligation.dueAt.toISOString(),
      status: obligation.status,
      report: obligation.report,
      tranche: obligation.tranche,
    })),
    options: {
      centres,
      fundingOrganisations,
      donorOrganisations: donorOrganisations.map((organisation) => ({ id: organisation.id, name: organisation.organisationName ?? organisation.name })),
      projects: projects.map((project) => ({ id: project.id, title: project.title, centreId: project.profile.centreId, centreName: project.profile.centre.centreName, requestedAmount: Number(project.requestedAmount) })),
      applications: applications.map((application) => ({
        id: application.id,
        applicationNumber: application.applicationNumber,
        label: `${application.applicationNumber} · ${application.project.profile.centre.centreName} · ${application.project.title}`,
        centreId: application.project.profile.centreId,
        centreName: application.project.profile.centre.centreName,
        projectId: application.projectId,
        projectTitle: application.project.title,
        organisationId: application.fundingOrganisationId,
        organisationName: application.fundingOrganisation?.name ?? null,
        approvedAmount: application.approvedAmount === null ? null : Number(application.approvedAmount),
      })),
      commitments: commitments.map((commitment) => ({
        id: commitment.id,
        referenceNumber: commitment.referenceNumber,
        label: `${commitment.referenceNumber} · ${commitment.donor.organisationName ?? commitment.donor.name}`,
        centreId: commitment.centreId,
        centreName: commitment.centre.centreName,
        fundingProjectId: commitment.project?.fundingProjectId ?? null,
        projectTitle: commitment.project?.fundingProject?.title ?? null,
        organisationId: commitment.donorOrganisationId,
        organisationName: commitment.donor.organisationName ?? commitment.donor.name,
        committedAmount: commitment.committedAmount === null ? null : Number(commitment.committedAmount),
      })),
      awards: awards.map((award) => ({ id: award.id, label: `${award.awardNumber} · ${award.centre.centreName} · ${award.fundingProject.title}`, tranches: award.tranches.map((tranche) => ({ id: tranche.id, label: `${award.awardNumber} · Tranche ${tranche.trancheNumber}${tranche.title ? ` · ${tranche.title}` : ""}` })) })),
    },
  };
}
