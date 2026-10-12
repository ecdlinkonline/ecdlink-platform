import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertBoundedCount, assertExportInputSize, grantReportExportLimits } from "@/lib/grant-report-export/limits";
import type { GrantReportExportData, SupportedGrantReportExportType } from "@/lib/grant-report-export/types";

const supportedTypes = new Set<SupportedGrantReportExportType>(["INTERIM", "FINAL", "QUARTERLY_EXPENDITURE", "QUARTERLY_CASH_FLOW"]);

export class UnsupportedGrantReportExportTypeError extends Error {
  constructor(reportType: string) {
    super(`Report type ${reportType} is not supported for PDF export.`);
    this.name = "UnsupportedGrantReportExportTypeError";
  }
}

type ExportClient = Pick<Prisma.TransactionClient, "grantReportVersion" | "grantReportFinancialLine" | "grantReportDocument" | "auditLog">;

export type GrantReportExportEvidenceSource = {
  documentId: string;
  fileAssetId: string;
  storageProvider: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum: string | null;
};

export type GrantReportVersionExportSource = {
  data: GrantReportExportData;
  evidenceFiles: GrantReportExportEvidenceSource[];
};

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function decimal(value: Prisma.Decimal | null | undefined) {
  return value?.toFixed(2) ?? null;
}

function record(value: Prisma.JsonValue | null): Prisma.JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function text(source: Prisma.JsonObject | null, key: string) {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function submissionMetadata(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { state: null, warningAcknowledged: false, warnings: null } as const;
  const state: "READY" | "NEEDS_REVIEW" | null = value.readinessState === "READY" || value.readinessState === "NEEDS_REVIEW" ? value.readinessState : null;
  const warningAcknowledged = value.warningAcknowledged === true;
  if (value.readinessWarningSnapshotVersion !== 1 || !Array.isArray(value.readinessWarnings)) return { state, warningAcknowledged, warnings: null };
  const warnings: Array<{ id: string; group: string; title: string; detail: string }> = [];
  for (const warning of value.readinessWarnings) {
    if (!warning || typeof warning !== "object" || Array.isArray(warning)) return { state, warningAcknowledged, warnings: null };
    if (typeof warning.id !== "string" || typeof warning.group !== "string" || typeof warning.title !== "string" || typeof warning.detail !== "string") {
      return { state, warningAcknowledged, warnings: null };
    }
    warnings.push({ id: warning.id, group: warning.group, title: warning.title, detail: warning.detail });
  }
  return { state, warningAcknowledged, warnings };
}

async function loadGrantReportVersionExportSource(
  input: { reportId: string; versionId: string },
  client: ExportClient = prisma,
): Promise<GrantReportVersionExportSource | null> {
  const core = await client.grantReportVersion.findFirst({
    where: { id: input.versionId, grantReportId: input.reportId },
    select: {
      id: true, grantReportId: true, versionNumber: true, status: true, reportType: true,
      reportingPeriodStart: true, reportingPeriodEnd: true, financialYear: true, quarter: true, currency: true,
      fundingReceivedTotal: true, otherIncomeTotal: true, totalIncome: true, quarterlyExpenditureTotal: true,
      cumulativeExpenditureTotal: true, totalExpenditure: true, surplusDeficit: true,
      openingBankBalance: true, closingBankBalance: true,
      executiveSummary: true, objectivesNarrative: true, deliverablesNarrative: true, organisationalChanges: true,
      communityChanges: true, challenges: true, lessonsLearned: true, nextSteps: true, financialNarrative: true,
      centreSnapshot: true, fundingOrganisationSnapshot: true, awardSnapshot: true, projectSnapshot: true,
      submittedAt: true,
      submittedBy: { select: { firstName: true, lastName: true } },
      report: {
        select: {
          status: true,
          obligation: { select: { title: true, type: true, dueAt: true } },
          award: {
            select: {
              awardNumber: true, title: true, awardedAmount: true,
              centre: { select: { centreName: true, npoNumber: true } },
              fundingProject: { select: { title: true } },
              organisations: {
                where: { removedAt: null }, orderBy: [{ isPrimary: "desc" }, { addedAt: "asc" }], take: 1,
                select: {
                  fundingOrganisation: { select: { name: true } },
                  donorOrganisation: { select: { name: true, organisationName: true } },
                },
              },
            },
          },
        },
      },
      indicators: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], take: grantReportExportLimits.indicators + 1,
        select: { id: true, objective: true, deliverable: true, indicator: true, baseline: true, target: true, achieved: true, status: true, progressNarrative: true, meansOfVerification: true },
      },
      beneficiaryBreakdowns: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], take: grantReportExportLimits.beneficiaries + 1,
        select: { category: true, total: true, male: true, female: true },
      },
      racialProfileRows: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], take: grantReportExportLimits.racialProfileRows + 1,
        select: { racialGroup: true, children: true, youth: true, men: true, women: true, olderPersons: true, peopleWithDisabilities: true },
      },
      sustainabilityItems: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], take: grantReportExportLimits.sustainabilityItems + 1,
        select: { plan: true, progressToDate: true },
      },
      certifications: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], take: grantReportExportLimits.certifications + 1,
        select: { party: true, nameSnapshot: true, designationSnapshot: true, certificationDate: true, digitallyConfirmed: true, confirmedAt: true, confirmationTextSnapshot: true },
      },
    },
  });
  if (!core) return null;
  if (!supportedTypes.has(core.reportType as SupportedGrantReportExportType)) throw new UnsupportedGrantReportExportTypeError(core.reportType);

  assertBoundedCount("indicators", core.indicators.length);
  assertBoundedCount("beneficiaries", core.beneficiaryBreakdowns.length);
  assertBoundedCount("racialProfileRows", core.racialProfileRows.length);
  assertBoundedCount("sustainabilityItems", core.sustainabilityItems.length);
  assertBoundedCount("certifications", core.certifications.length);

  const [financialLines, evidence, audit] = await Promise.all([
    client.grantReportFinancialLine.findMany({
      where: { grantReportVersionId: core.id }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      take: grantReportExportLimits.financialLines + 1,
      select: {
        id: true, lineType: true, categoryCode: true, categoryName: true, description: true,
        approvedBudget: true, quarterlyBudget: true, quarterlyActual: true, fundingSourceActual: true,
        otherSourceActual: true, cumulativeActual: true, estimatedExpenditure: true, variance: true,
        reasonForVariance: true, displayOrder: true,
      },
    }),
    client.grantReportDocument.findMany({
      where: { grantReportVersionId: core.id }, orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
      take: grantReportExportLimits.evidenceItems + 1,
      select: {
        id: true, documentType: true, title: true, description: true, originalFilenameSnapshot: true,
        mimeTypeSnapshot: true, fileSizeSnapshot: true, checksumSnapshot: true, uploadedAt: true,
        fileAssetId: true,
        file: { select: { storageProvider: true, storageKey: true, originalFilename: true, mimeType: true, fileSize: true, checksum: true } },
        indicator: { select: { id: true, objective: true } },
        financialLine: { select: { id: true, categoryName: true, lineType: true } },
      },
    }),
    client.auditLog.findFirst({
      where: { action: "grant.report.submitted", entityType: "GrantReportVersion", entityId: core.id },
      orderBy: { createdAt: "desc" }, select: { metadata: true },
    }),
  ]);
  assertBoundedCount("financialLines", financialLines.length);
  assertBoundedCount("evidenceItems", evidence.length);

  const isDraft = core.status === "DRAFT";
  const awardSnapshot = record(core.awardSnapshot);
  const centreSnapshot = record(core.centreSnapshot);
  const projectSnapshot = record(core.projectSnapshot);
  const organisationSnapshot = record(core.fundingOrganisationSnapshot);
  const lead = core.report.award.organisations[0];
  const currentLead = lead?.fundingOrganisation?.name ?? lead?.donorOrganisation?.organisationName ?? lead?.donorOrganisation?.name ?? null;
  const submittedBy = core.submittedBy ? [core.submittedBy.firstName, core.submittedBy.lastName].filter(Boolean).join(" ") || null : null;
  const unavailableSnapshots: string[] = [];
  if (!isDraft && !text(awardSnapshot, "awardNumber")) unavailableSnapshots.push("award identity snapshot");
  if (!isDraft && !text(centreSnapshot, "centreName")) unavailableSnapshots.push("centre snapshot");
  if (!isDraft && !text(projectSnapshot, "title")) unavailableSnapshots.push("project snapshot");
  if (!isDraft && !text(organisationSnapshot, "name")) unavailableSnapshots.push("funding organisation snapshot");
  if (!isDraft) unavailableSnapshots.push("obligation title and due-date version snapshot");
  if (!isDraft && !audit) unavailableSnapshots.push("submission readiness audit snapshot");

  const data: GrantReportExportData = {
    report: {
      id: core.grantReportId, versionId: core.id, versionNumber: core.versionNumber,
      reportStatus: core.report.status, versionStatus: core.status,
      reportType: core.reportType as SupportedGrantReportExportType, obligationType: core.report.obligation.type,
      title: core.report.obligation.title, dueAt: core.report.obligation.dueAt.toISOString(),
      reportingPeriodStart: iso(core.reportingPeriodStart), reportingPeriodEnd: iso(core.reportingPeriodEnd),
      financialYear: core.financialYear, quarter: core.quarter, currency: core.currency,
      submittedAt: iso(core.submittedAt), submittedBy,
    },
    identity: {
      awardNumber: text(awardSnapshot, "awardNumber") ?? (isDraft ? core.report.award.awardNumber : null),
      awardTitle: text(awardSnapshot, "title") ?? (isDraft ? core.report.award.title : null),
      awardedAmount: text(awardSnapshot, "awardedAmount") ?? (isDraft ? core.report.award.awardedAmount.toFixed(2) : null),
      centreName: text(centreSnapshot, "centreName") ?? (isDraft ? core.report.award.centre.centreName : null),
      centreNpoNumber: text(centreSnapshot, "npoNumber") ?? (isDraft ? core.report.award.centre.npoNumber : null),
      projectTitle: text(projectSnapshot, "title") ?? (isDraft ? core.report.award.fundingProject.title : null),
      leadOrganisation: text(organisationSnapshot, "name") ?? (isDraft ? currentLead : null),
    },
    totals: {
      fundingReceived: core.fundingReceivedTotal.toFixed(2), otherIncome: core.otherIncomeTotal.toFixed(2),
      totalIncome: core.totalIncome.toFixed(2), quarterlyExpenditure: core.quarterlyExpenditureTotal.toFixed(2),
      cumulativeExpenditure: core.cumulativeExpenditureTotal.toFixed(2), totalExpenditure: core.totalExpenditure.toFixed(2),
      surplusDeficit: core.surplusDeficit.toFixed(2), openingBankBalance: decimal(core.openingBankBalance),
      closingBankBalance: decimal(core.closingBankBalance),
    },
    narratives: {
      executiveSummary: core.executiveSummary, objectives: core.objectivesNarrative, deliverables: core.deliverablesNarrative,
      organisationalChanges: core.organisationalChanges, communityChanges: core.communityChanges, challenges: core.challenges,
      lessonsLearned: core.lessonsLearned, nextSteps: core.nextSteps, financial: core.financialNarrative,
    },
    financialLines: financialLines.map((line) => ({
      ...line, lineType: line.lineType, approvedBudget: decimal(line.approvedBudget), quarterlyBudget: decimal(line.quarterlyBudget),
      quarterlyActual: decimal(line.quarterlyActual), fundingSourceActual: decimal(line.fundingSourceActual),
      otherSourceActual: decimal(line.otherSourceActual), cumulativeActual: decimal(line.cumulativeActual),
      estimatedExpenditure: decimal(line.estimatedExpenditure), variance: decimal(line.variance),
    })),
    indicators: core.indicators.map((row) => ({ ...row, status: row.status })),
    beneficiaries: core.beneficiaryBreakdowns.map((row) => ({ ...row, category: row.category })),
    racialProfile: core.racialProfileRows.map((row) => ({ ...row, racialGroup: row.racialGroup })),
    sustainability: core.sustainabilityItems,
    certifications: core.certifications.map((row) => ({
      party: row.party, name: row.nameSnapshot, designation: row.designationSnapshot,
      certificationDate: iso(row.certificationDate), digitallyConfirmed: row.digitallyConfirmed,
      confirmedAt: iso(row.confirmedAt), confirmationText: row.confirmationTextSnapshot,
    })),
    evidence: evidence.map((document) => ({
      id: document.id, documentType: document.documentType, title: document.title, description: document.description,
      originalFilename: document.originalFilenameSnapshot, mimeType: document.mimeTypeSnapshot,
      fileSize: document.fileSizeSnapshot, checksum: document.checksumSnapshot, uploadedAt: document.uploadedAt.toISOString(),
      indicator: document.indicator ? { id: document.indicator.id, label: document.indicator.objective } : null,
      financialLine: document.financialLine ? { id: document.financialLine.id, label: document.financialLine.categoryName, lineType: document.financialLine.lineType } : null,
    })),
    readiness: submissionMetadata(audit?.metadata ?? null),
    historicalIntegrity: { usesVersionOwnedContent: true, exactLegacyReproductionClaimed: false, unavailableSnapshots },
  };
  const narrativeCharacters = Object.values(data.narratives).reduce((total, value) => total + (value?.length ?? 0), 0);
  assertBoundedCount("narrativeCharacters", narrativeCharacters);
  assertExportInputSize(data);
  return {
    data,
    evidenceFiles: evidence.map((document) => ({
      documentId: document.id,
      fileAssetId: document.fileAssetId,
      storageProvider: document.file.storageProvider,
      storageKey: document.file.storageKey,
      originalFilename: document.file.originalFilename,
      mimeType: document.file.mimeType,
      fileSize: document.file.fileSize,
      checksum: document.file.checksum,
    })),
  };
}

export async function getGrantReportVersionExportData(
  input: { reportId: string; versionId: string },
  client: ExportClient = prisma,
) {
  return (await loadGrantReportVersionExportSource(input, client))?.data ?? null;
}

export async function getGrantReportVersionExportSource(
  input: { reportId: string; versionId: string },
  client: ExportClient = prisma,
) {
  return loadGrantReportVersionExportSource(input, client);
}
