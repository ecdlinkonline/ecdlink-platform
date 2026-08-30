import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildSuggestedGrantIndicators, dbeQuarterlyCashFlowExpenseCategories, dbeQuarterlyExpenditureCategories, grantReportCompletion, mapQuarterlyExpenditureIncomeToCashReceived, quarterlyCashFlowCompletion, quarterlyCashFlowTotals, quarterlyExpenditureCompletion, resolveGrantReportTemplate } from "@/lib/grant-reports/editor";
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
        signedAgreementFile: { select: { id: true, originalFilename: true, mimeType: true, fileSize: true, createdAt: true } },
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
      agreementDate: dateValue(award.agreementDate),
      signedByBothParties: award.signedByBothParties,
      signedAgreement: award.signedAgreementFile ? {
        id: award.signedAgreementFile.id,
        originalFilename: award.signedAgreementFile.originalFilename,
        mimeType: award.signedAgreementFile.mimeType,
        fileSize: award.signedAgreementFile.fileSize,
        uploadedAt: award.signedAgreementFile.createdAt.toISOString(),
      } : null,
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

function recordValue(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function snapshotString(snapshot: Record<string, unknown> | null, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" ? value : null;
}

function decimalString(value: Prisma.Decimal | null | undefined) {
  return value?.toFixed(2) ?? null;
}

export type QuarterlyExpenditureIncomeSourceCriteria = {
  grantAwardId: string;
  centreId: string;
  financialYear: string;
  quarter: number;
};

export async function findMatchingQuarterlyExpenditureIncome(
  criteria: QuarterlyExpenditureIncomeSourceCriteria,
  client: Pick<Prisma.TransactionClient, "grantReportVersion"> = prisma,
) {
  for (const status of ["APPROVED", "SUBMITTED", "DRAFT"] as const) {
    const candidates = await client.grantReportVersion.findMany({
      where: {
        reportType: "QUARTERLY_EXPENDITURE",
        status,
        financialYear: criteria.financialYear,
        quarter: criteria.quarter,
        financialLines: { some: { lineType: { in: ["FUNDING_RECEIVED", "OTHER_INCOME"] } } },
        report: {
          grantAwardId: criteria.grantAwardId,
          status: status === "DRAFT" ? { in: ["DRAFT", "RETURNED"] } : status,
          award: { centreId: criteria.centreId },
          obligation: { type: "QUARTERLY_EXPENDITURE", financialYear: criteria.financialYear, quarter: criteria.quarter },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { versionNumber: "desc" }, { id: "desc" }],
      take: 25,
      select: {
        id: true,
        status: true,
        versionNumber: true,
        report: { select: { currentVersionNumber: true } },
        financialLines: {
          where: { lineType: { in: ["FUNDING_RECEIVED", "OTHER_INCOME"] } },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          select: { lineType: true, categoryName: true, quarterlyActual: true },
        },
      },
    });
    const current = candidates.find((candidate) => candidate.versionNumber === candidate.report.currentVersionNumber);
    if (current) return {
      status: current.status,
      rows: mapQuarterlyExpenditureIncomeToCashReceived(current.financialLines.map((row) => ({ lineType: row.lineType as "FUNDING_RECEIVED" | "OTHER_INCOME", categoryName: row.categoryName, amount: decimalString(row.quarterlyActual) }))),
    };
  }
  return null;
}

export async function getGrantReportEditor(reportId: string) {
  const report = await prisma.grantReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      currentVersionNumber: true,
      obligation: { select: { id: true, title: true, type: true, dueAt: true, reportingPeriodStart: true, reportingPeriodEnd: true, financialYear: true, quarter: true, tranche: { select: { id: true, trancheNumber: true, scheduledAmount: true } } } },
      award: {
        select: {
          id: true,
          awardNumber: true,
          title: true,
          awardedAmount: true,
          currency: true,
          centre: { select: { id: true, centreName: true, npoNumber: true, physicalAddress: true, suburb: true, area: true, province: true, postalCode: true, contactPerson: true, phone: true, email: true } },
          fundingProject: { select: { id: true, title: true, objective: true, expectedOutcomes: true, requiredItems: true } },
          organisations: partyInclude,
        },
      },
    },
  });
  if (!report) return null;

  const version = await prisma.grantReportVersion.findUnique({
    where: { grantReportId_versionNumber: { grantReportId: report.id, versionNumber: report.currentVersionNumber } },
    include: {
      indicators: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
      beneficiaryBreakdowns: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
      racialProfileRows: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
      sustainabilityItems: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
      financialLines: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
      certifications: { include: { confirmedBy: { select: { firstName: true, lastName: true, email: true } } }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
      documents: { include: { file: { select: { originalFilename: true, mimeType: true, fileSize: true, createdAt: true } }, indicator: { select: { id: true, objective: true } }, uploadedBy: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!version) return null;

  const editable = version.status === "DRAFT" && !["SUBMITTED", "APPROVED", "ARCHIVED"].includes(report.status);
  const periodStart = version.reportingPeriodStart ?? (editable ? report.obligation.reportingPeriodStart : null);
  const periodEnd = version.reportingPeriodEnd ?? (editable ? report.obligation.reportingPeriodEnd : null);
  const dateFilter = periodStart || periodEnd ? { gte: periodStart ?? undefined, lte: periodEnd ?? undefined } : undefined;
  const canSuggestPeriodTotals = editable && Boolean(periodStart && periodEnd);
  const [received, spent] = await Promise.all([
    canSuggestPeriodTotals ? prisma.grantDisbursement.aggregate({ where: { grantAwardId: report.award.id, receivedAt: dateFilter }, _sum: { amountReceived: true } }) : Promise.resolve({ _sum: { amountReceived: null } }),
    canSuggestPeriodTotals ? prisma.grantExpenseAllocation.aggregate({ where: { grantAwardId: report.award.id, reversedAt: null, allocationDate: dateFilter }, _sum: { allocatedAmount: true } }) : Promise.resolve({ _sum: { allocatedAmount: null } }),
  ]);
  const suggestedFundingReceived = canSuggestPeriodTotals ? decimalString(received._sum.amountReceived) : null;

  const centreSnapshot = recordValue(version.centreSnapshot);
  const awardSnapshot = recordValue(version.awardSnapshot);
  const projectSnapshot = recordValue(version.projectSnapshot);
  const organisationSnapshot = recordValue(version.fundingOrganisationSnapshot);
  const useCurrentFallback = editable;
  const addressParts = [report.award.centre.physicalAddress, report.award.centre.suburb, report.award.centre.area, report.award.centre.province, report.award.centre.postalCode].filter(Boolean);
  const currentParty = partyName(report.award.organisations);

  const suggestedIndicators = buildSuggestedGrantIndicators(report.award.fundingProject, version.indicators.length);
  const incomeLines = version.financialLines.filter((row) => row.lineType === "FUNDING_RECEIVED" || row.lineType === "OTHER_INCOME");
  const expenditureLines = version.financialLines.filter((row) => row.lineType === "EXPENDITURE");
  const cashFlowFinancialYear = version.financialYear ?? (editable ? report.obligation.financialYear : null);
  const cashFlowQuarter = version.quarter ?? (editable ? report.obligation.quarter : null);
  const cashFlowIncomeSource = version.reportType === "QUARTERLY_CASH_FLOW" && editable && incomeLines.length === 0 && cashFlowFinancialYear && cashFlowQuarter
    ? await findMatchingQuarterlyExpenditureIncome({ grantAwardId: report.award.id, centreId: report.award.centre.id, financialYear: cashFlowFinancialYear, quarter: cashFlowQuarter })
    : null;
  const cashFlowIncomeRows = incomeLines.length
    ? incomeLines.map((row) => ({ id: row.id, lineType: row.lineType as "FUNDING_RECEIVED" | "OTHER_INCOME", categoryName: row.categoryName, amount: decimalString(row.quarterlyActual) }))
    : cashFlowIncomeSource?.rows.length ? cashFlowIncomeSource.rows : [
      { lineType: "FUNDING_RECEIVED" as const, categoryName: "Subsidy", amount: null },
      { lineType: "OTHER_INCOME" as const, categoryName: "Other Income", amount: null },
    ];

  const documents = version.documents.map((document) => ({
    id: document.id,
    documentType: document.documentType,
    title: document.title,
    description: document.description,
    indicatorId: document.indicatorId,
    indicator: document.indicator?.objective ?? null,
    originalFilename: document.file.originalFilename,
    mimeType: document.file.mimeType,
    fileSize: document.file.fileSize,
    uploadedAt: document.uploadedAt.toISOString(),
    uploadedBy: [document.uploadedBy.firstName, document.uploadedBy.lastName].filter(Boolean).join(" ") || document.uploadedBy.email || "Internal user",
  }));
  const completion = version.reportType === "QUARTERLY_EXPENDITURE" ? quarterlyExpenditureCompletion({
    financialYear: version.financialYear,
    quarter: version.quarter,
    reportingPeriodStart: dateValue(version.reportingPeriodStart),
    reportingPeriodEnd: dateValue(version.reportingPeriodEnd),
    incomeLineCount: incomeLines.length,
    expenditureLineCount: expenditureLines.length,
    openingBankBalance: decimalString(version.openingBankBalance),
    closingBankBalance: decimalString(version.closingBankBalance),
    certificationCount: version.certifications.length,
    confirmedCertificationCount: version.certifications.filter((item) => item.digitallyConfirmed).length,
  }) : version.reportType === "QUARTERLY_CASH_FLOW" ? quarterlyCashFlowCompletion({
    financialYear: version.financialYear,
    quarter: version.quarter,
    reportingPeriodStart: dateValue(version.reportingPeriodStart),
    reportingPeriodEnd: dateValue(version.reportingPeriodEnd),
    cashReceivedLineCount: incomeLines.length,
    operatingExpenseLineCount: expenditureLines.length,
    unresolvedVarianceCount: expenditureLines.filter((row) => row.variance && !row.variance.isZero() && !row.reasonForVariance?.trim()).length,
    certificationCount: version.certifications.length,
    confirmedCertificationCount: version.certifications.filter((item) => item.digitallyConfirmed).length,
  }) : grantReportCompletion({
    reportType: version.reportType,
    reportingPeriodStart: dateValue(version.reportingPeriodStart),
    reportingPeriodEnd: dateValue(version.reportingPeriodEnd),
    indicatorCount: version.indicators.length,
    beneficiaryCount: version.beneficiaryBreakdowns.length,
    racialRowCount: version.racialProfileRows.length,
    challenges: version.challenges,
    sustainabilityCount: version.sustainabilityItems.length,
    financialLineCount: version.financialLines.length,
    certificationCount: version.certifications.length,
    confirmedCertificationCount: version.certifications.filter((item) => item.digitallyConfirmed).length,
    hasAuditedFinancialStatements: documents.some((document) => document.documentType === "AUDITED_FINANCIAL_STATEMENTS"),
  });

  return {
    report: { id: report.id, title: report.obligation.title, status: report.status, type: version.reportType, template: resolveGrantReportTemplate(version.reportType), dueAt: report.obligation.dueAt.toISOString() },
    version: { id: version.id, versionNumber: version.versionNumber, status: version.status, editable, currency: version.currency, completion },
    general: {
      reportType: version.reportType,
      awardNumber: snapshotString(awardSnapshot, "awardNumber") ?? (useCurrentFallback ? report.award.awardNumber : null),
      projectTitle: snapshotString(projectSnapshot, "title") ?? (useCurrentFallback ? report.award.fundingProject.title : null),
      sector: null,
      centreName: snapshotString(centreSnapshot, "centreName") ?? (useCurrentFallback ? report.award.centre.centreName : null),
      physicalAddress: snapshotString(centreSnapshot, "physicalAddress") ?? (useCurrentFallback ? addressParts.join(", ") || null : null),
      npoNumber: snapshotString(centreSnapshot, "npoNumber") ?? (useCurrentFallback ? report.award.centre.npoNumber : null),
      contactPerson: snapshotString(centreSnapshot, "contactPerson") ?? (useCurrentFallback ? report.award.centre.contactPerson : null),
      telephone: snapshotString(centreSnapshot, "phone") ?? (useCurrentFallback ? report.award.centre.phone : null),
      email: snapshotString(centreSnapshot, "email") ?? (useCurrentFallback ? report.award.centre.email : null),
      leadOrganisation: snapshotString(organisationSnapshot, "name") ?? (useCurrentFallback ? currentParty : null),
      reportingPeriodStart: dateValue(version.reportingPeriodStart ?? (useCurrentFallback ? report.obligation.reportingPeriodStart : null)),
      reportingPeriodEnd: dateValue(version.reportingPeriodEnd ?? (useCurrentFallback ? report.obligation.reportingPeriodEnd : null)),
      financialYear: version.financialYear ?? (useCurrentFallback ? report.obligation.financialYear : null),
      quarter: version.quarter ?? (useCurrentFallback ? report.obligation.quarter : null),
      trancheNumber: version.trancheNumberSnapshot ?? (useCurrentFallback ? report.obligation.tranche?.trancheNumber : null) ?? null,
      trancheAmount: decimalString(version.trancheAmountSnapshot ?? (useCurrentFallback ? report.obligation.tranche?.scheduledAmount : null)),
      previousTrancheBalance: decimalString(version.previousTrancheBalance),
    },
    indicators: version.indicators.map((row) => ({ id: row.id, objective: row.objective, deliverable: row.deliverable, achieved: row.achieved, status: row.status, meansOfVerification: row.meansOfVerification })),
    suggestedIndicators,
    beneficiaries: version.beneficiaryBreakdowns.map((row) => ({ category: row.category, total: row.total, male: row.male, female: row.female })),
    racialRows: version.racialProfileRows.map((row) => ({ racialGroup: row.racialGroup, children: row.children, youth: row.youth, men: row.men, women: row.women, olderPersons: row.olderPersons, peopleWithDisabilities: row.peopleWithDisabilities })),
    sustainability: { challenges: version.challenges, organisationalChanges: version.organisationalChanges, communityChanges: version.communityChanges, rows: version.sustainabilityItems.map((row) => ({ id: row.id, plan: row.plan, progressToDate: row.progressToDate })) },
    financial: {
      totalGrantValue: snapshotString(awardSnapshot, "awardedAmount") ?? (useCurrentFallback ? report.award.awardedAmount.toFixed(2) : null),
      fundingReceivedTotal: version.fundingReceivedTotal.toFixed(2),
      previousTrancheBalance: decimalString(version.previousTrancheBalance),
      quarterlyExpenditureTotal: version.quarterlyExpenditureTotal.toFixed(2),
      suggestedFundingReceivedTotal: canSuggestPeriodTotals ? (received._sum.amountReceived ?? new Prisma.Decimal(0)).toFixed(2) : null,
      suggestedQuarterlyExpenditureTotal: canSuggestPeriodTotals ? (spent._sum.allocatedAmount ?? new Prisma.Decimal(0)).toFixed(2) : null,
      rows: expenditureLines.map((row) => ({ id: row.id, categoryName: row.categoryName, description: row.description, approvedBudget: decimalString(row.approvedBudget), quarterlyActual: decimalString(row.quarterlyActual) })),
    },
    quarterlyExpenditure: {
      incomeRows: incomeLines.length ? incomeLines.map((row) => ({ id: row.id, lineType: row.lineType as "FUNDING_RECEIVED" | "OTHER_INCOME", categoryName: row.categoryName, amount: decimalString(row.quarterlyActual) })) : [
        { lineType: "FUNDING_RECEIVED" as const, categoryName: "Funding received from Department / Subsidy", amount: suggestedFundingReceived },
        { lineType: "OTHER_INCOME" as const, categoryName: "Other Income", amount: null },
      ],
      expenditureRows: expenditureLines.length ? expenditureLines.map((row) => ({ id: row.id, categoryName: row.categoryName, costingFrameworkPercentage: decimalString(row.costingFrameworkPercentage), quarterlyBudget: decimalString(row.quarterlyBudget), fundingSourceActual: decimalString(row.fundingSourceActual), otherSourceActual: decimalString(row.otherSourceActual), quarterlyActual: decimalString(row.quarterlyActual) ?? "0.00" })) : dbeQuarterlyExpenditureCategories.map((categoryName) => ({ categoryName, costingFrameworkPercentage: null, quarterlyBudget: null, fundingSourceActual: null, otherSourceActual: null, quarterlyActual: "0.00" })),
      totals: {
        fundingReceivedTotal: version.fundingReceivedTotal.toFixed(2),
        otherIncomeTotal: version.otherIncomeTotal.toFixed(2),
        totalIncome: version.totalIncome.toFixed(2),
        quarterlyExpenditureTotal: version.quarterlyExpenditureTotal.toFixed(2),
        totalExpenditure: version.totalExpenditure.toFixed(2),
        surplusDeficit: version.surplusDeficit.toFixed(2),
      },
      openingBankBalance: decimalString(version.openingBankBalance),
      closingBankBalance: decimalString(version.closingBankBalance),
      suggestedFundingReceivedTotal: suggestedFundingReceived,
    },
    quarterlyCashFlow: {
      cashReceivedRows: cashFlowIncomeRows,
      cashReceivedSaved: incomeLines.length > 0,
      matchingExpenditureIncomeFound: Boolean(cashFlowIncomeSource),
      operatingExpenseRows: expenditureLines.length ? expenditureLines.map((row) => ({ id: row.id, categoryName: row.categoryName, quarterlyBudget: decimalString(row.quarterlyBudget), estimatedExpenditure: decimalString(row.estimatedExpenditure), variance: decimalString(row.variance) ?? "0.00", reasonForVariance: row.reasonForVariance })) : dbeQuarterlyCashFlowExpenseCategories.map((categoryName) => ({ categoryName, quarterlyBudget: null, estimatedExpenditure: null, variance: "0.00", reasonForVariance: null })),
      totals: {
        ...quarterlyCashFlowTotals(cashFlowIncomeRows.map((row) => row.amount), expenditureLines.map((row) => ({ quarterlyBudget: decimalString(row.quarterlyBudget), estimatedExpenditure: decimalString(row.estimatedExpenditure) }))),
      },
    },
    documents,
    certifications: version.certifications.map((row) => ({ id: row.id, party: row.party, nameSnapshot: row.nameSnapshot, designationSnapshot: row.designationSnapshot, certificationDate: dateValue(row.certificationDate), digitallyConfirmed: row.digitallyConfirmed, confirmedAt: dateValue(row.confirmedAt), confirmedBy: row.confirmedBy ? [row.confirmedBy.firstName, row.confirmedBy.lastName].filter(Boolean).join(" ") || row.confirmedBy.email || "Internal user" : null })),
    requirements: { auditedFinancialStatementsRequired: version.reportType === "FINAL", sectorUnavailable: true, approvedBudgetSourceUnavailable: true },
  };
}
