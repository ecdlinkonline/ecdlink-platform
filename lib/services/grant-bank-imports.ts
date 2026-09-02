import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertGrantBankImportCapacity, expectedGrantBankStatementMonths, grantBankImportMatchesContext, isEditableGrantBankImportStatus, isGrantBankImportReportType, type GrantBankImportWorkspaceDto } from "@/lib/grant-reports/bank-import";
import { findActiveSuperAdmin, findConfirmedGrantBankImport, findEditableGrantBankImport, findGrantBankImport, findGrantBankReportContext, grantBankImportInclude, type GrantBankImportRecord } from "@/lib/repositories/grant-bank-imports";
import { storage } from "@/lib/storage/storage-service";
import type { SignedFileAccess } from "@/lib/storage/types";
import { defaultDocumentPolicy, type StorageUploadFile } from "@/lib/storage/validation";
import type { GrantBankStatementMetadataInput, UploadGrantBankStatementInput } from "@/lib/validators/grant-bank-imports";

export const grantBankStatementPolicy = defaultDocumentPolicy;

export class GrantBankImportError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

type ReportContext = NonNullable<Awaited<ReturnType<typeof findGrantBankReportContext>>>;

function dateOnly(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function reportPeriod(context: ReportContext) {
  const financialYear = context.version.financialYear ?? context.obligation.financialYear;
  const quarter = context.version.quarter ?? context.obligation.quarter;
  const reportingPeriodStart = context.version.reportingPeriodStart ?? context.obligation.reportingPeriodStart;
  const reportingPeriodEnd = context.version.reportingPeriodEnd ?? context.obligation.reportingPeriodEnd;
  if (!financialYear || !quarter || !reportingPeriodStart || !reportingPeriodEnd) {
    throw new GrantBankImportError("Save the report financial year, quarter and reporting period before importing bank statements.", 422);
  }
  return { financialYear, quarter, reportingPeriodStart, reportingPeriodEnd };
}

export function assertGrantBankReportEligibility(input: { reportType: string; reportStatus: string; versionStatus: string }, creating = false) {
  if (!isGrantBankImportReportType(input.reportType)) throw new GrantBankImportError("Bank statement import is available only for Quarterly Expenditure and Quarterly Cash Flow reports.", 422);
  if (creating && (!["DRAFT", "RETURNED"].includes(input.reportStatus) || input.versionStatus !== "DRAFT")) {
    throw new GrantBankImportError("Bank statements can be added only while the current report version is editable.", 409);
  }
}

export function assertGrantBankImportAlignment(batch: Pick<GrantBankImportRecord, "grantAwardId" | "centreId" | "originatingGrantReportId" | "financialYear" | "quarter">, context: ReportContext) {
  const period = reportPeriod(context);
  if (!grantBankImportMatchesContext(batch, { reportId: context.id, grantAwardId: context.award.id, centreId: context.award.centreId, financialYear: period.financialYear, quarter: period.quarter })) {
    throw new GrantBankImportError("The bank import does not belong to this report, award, centre and reporting period.", 404);
  }
  return period;
}

function assertEditableBatch(batch: GrantBankImportRecord, context: ReportContext) {
  assertGrantBankReportEligibility({ reportType: context.version.reportType, reportStatus: context.status, versionStatus: context.version.status }, true);
  assertGrantBankImportAlignment(batch, context);
  if (!isEditableGrantBankImportStatus(batch.status)) throw new GrantBankImportError("This bank import is no longer editable.", 409);
}

async function requireActorAndContext(tx: Prisma.TransactionClient, actorUserId: string, reportId: string) {
  const [actor, context] = await Promise.all([findActiveSuperAdmin(tx, actorUserId), findGrantBankReportContext(tx, reportId)]);
  if (!actor) throw new GrantBankImportError("Only an active Super Admin can manage bank statement imports.", 403);
  if (!context) throw new GrantBankImportError("Grant report not found.", 404);
  assertGrantBankReportEligibility({ reportType: context.version.reportType, reportStatus: context.status, versionStatus: context.version.status });
  return context;
}

function reportIsEditable(context: ReportContext) {
  return ["DRAFT", "RETURNED"].includes(context.status) && context.version.status === "DRAFT";
}

function toWorkspaceDto(batch: GrantBankImportRecord, reportType: string, reportEditable = true): GrantBankImportWorkspaceDto {
  if (!isGrantBankImportReportType(reportType)) throw new GrantBankImportError("This report does not support bank statement import.", 422);
  const start = dateOnly(batch.reportingPeriodStart)!;
  const end = dateOnly(batch.reportingPeriodEnd)!;
  return {
    id: batch.id,
    reportId: batch.originatingGrantReportId,
    reportType,
    centreName: batch.award.centre.centreName,
    awardNumber: batch.award.awardNumber,
    awardTitle: batch.award.title,
    financialYear: batch.financialYear,
    quarter: batch.quarter,
    reportingPeriodStart: start,
    reportingPeriodEnd: end,
    currency: batch.currency,
    status: batch.status,
    editable: reportEditable && isEditableGrantBankImportStatus(batch.status),
    statementsUploaded: batch.statements.length,
    expectedMonths: expectedGrantBankStatementMonths(start, end),
    statements: batch.statements.map((statement) => ({
      id: statement.id,
      originalFilename: statement.file.originalFilename,
      mimeType: statement.file.mimeType,
      fileSize: statement.file.fileSize,
      status: statement.extractionStatus,
      statementMonth: dateOnly(statement.statementMonth),
      periodStart: dateOnly(statement.periodStart),
      periodEnd: dateOnly(statement.periodEnd),
      statementDate: dateOnly(statement.statementDate),
      bankName: statement.bankName,
      accountHolderName: statement.accountHolderName,
      maskedAccountReference: statement.maskedAccountReference,
      openingBalance: statement.openingBalance?.toFixed(2) ?? null,
      closingBalance: statement.closingBalance?.toFixed(2) ?? null,
      currency: statement.currency,
    })),
  };
}

export async function createOrResumeGrantBankImport(reportId: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const context = await requireActorAndContext(tx, actorUserId, reportId);
    const period = reportPeriod(context);
    const lookup = { reportId, awardId: context.award.id, financialYear: period.financialYear, quarter: period.quarter };
    const confirmed = await findConfirmedGrantBankImport(tx, lookup);
    if (confirmed) {
      assertGrantBankImportAlignment(confirmed, context);
      return toWorkspaceDto(confirmed, context.version.reportType, reportIsEditable(context));
    }
    const existing = await findEditableGrantBankImport(tx, lookup);
    if (existing) {
      assertGrantBankImportAlignment(existing, context);
      return toWorkspaceDto(existing, context.version.reportType, reportIsEditable(context));
    }
    assertGrantBankReportEligibility({ reportType: context.version.reportType, reportStatus: context.status, versionStatus: context.version.status }, true);
    const batch = await tx.grantBankImportBatch.create({
      data: {
        grantAwardId: context.award.id,
        centreId: context.award.centreId,
        originatingGrantReportId: context.id,
        financialYear: period.financialYear,
        quarter: period.quarter,
        reportingPeriodStart: period.reportingPeriodStart,
        reportingPeriodEnd: period.reportingPeriodEnd,
        currency: context.version.currency || context.award.currency,
        status: "UPLOADING",
        createdByUserId: actorUserId,
      },
      include: grantBankImportInclude,
    });
    await tx.auditLog.create({ data: { actorUserId, action: "grant.bank_import.created", entityType: "GrantBankImportBatch", entityId: batch.id, metadata: { reportId, grantAwardId: context.award.id, centreId: context.award.centreId, financialYear: period.financialYear, quarter: period.quarter } } });
    return toWorkspaceDto(batch, context.version.reportType, reportIsEditable(context));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getGrantBankImportWorkspace(input: { reportId: string; importId: string; actorUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const context = await requireActorAndContext(tx, input.actorUserId, input.reportId);
    const batch = await findGrantBankImport(tx, input.reportId, input.importId);
    if (!batch) throw new GrantBankImportError("Bank statement import not found.", 404);
    assertGrantBankImportAlignment(batch, context);
    return toWorkspaceDto(batch, context.version.reportType, reportIsEditable(context));
  });
}

function metadataData(metadata: GrantBankStatementMetadataInput) {
  const date = (value: string | null) => value ? new Date(`${value}T00:00:00.000Z`) : null;
  return {
    statementMonth: date(metadata.statementMonth),
    periodStart: date(metadata.periodStart),
    periodEnd: date(metadata.periodEnd),
    statementDate: date(metadata.statementDate),
    bankName: metadata.bankName,
    accountHolderName: metadata.accountHolderName,
    maskedAccountReference: metadata.maskedAccountReference,
    openingBalance: metadata.openingBalance,
    closingBalance: metadata.closingBalance,
    currency: metadata.currency,
  };
}

async function requireMutableBatch(tx: Prisma.TransactionClient, input: { reportId: string; importId: string; actorUserId: string }) {
  const context = await requireActorAndContext(tx, input.actorUserId, input.reportId);
  const batch = await findGrantBankImport(tx, input.reportId, input.importId);
  if (!batch) throw new GrantBankImportError("Bank statement import not found.", 404);
  assertEditableBatch(batch, context);
  return { context, batch };
}

export async function uploadGrantBankStatement(input: { reportId: string; importId: string; actorUserId: string; file: StorageUploadFile; metadata: UploadGrantBankStatementInput }) {
  const initial = await prisma.$transaction((tx) => requireMutableBatch(tx, input));
  const replacing = Boolean(input.metadata.replaceStatementId);
  const replaced = input.metadata.replaceStatementId ? initial.batch.statements.find((statement) => statement.id === input.metadata.replaceStatementId) : null;
  if (input.metadata.replaceStatementId && !replaced) throw new GrantBankImportError("The statement to replace was not found in this import.", 404);
  if (replaced && (replaced.extractionStatus !== "PENDING" || replaced._count.transactions > 0 || replaced._count.processingAttempts > 0)) throw new GrantBankImportError("This statement can no longer be replaced.", 409);
  try { assertGrantBankImportCapacity(initial.batch.statements.length, replacing); } catch (error) { throw new GrantBankImportError(error instanceof Error ? error.message : "This import already has three bank statements.", 409); }

  const file = await storage.uploadFileAsset({ file: input.file, module: "funding", ownerId: input.actorUserId, entityId: input.importId, uploadedByUserId: input.actorUserId, policy: grantBankStatementPolicy });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const { context, batch } = await requireMutableBatch(tx, input);
      const current = input.metadata.replaceStatementId ? batch.statements.find((statement) => statement.id === input.metadata.replaceStatementId) : null;
      if (input.metadata.replaceStatementId && !current) throw new GrantBankImportError("The statement to replace was not found in this import.", 404);
      if (current && (current.extractionStatus !== "PENDING" || current._count.transactions > 0 || current._count.processingAttempts > 0)) throw new GrantBankImportError("This statement can no longer be replaced.", 409);
      try { assertGrantBankImportCapacity(batch.statements.length, Boolean(current)); } catch (error) { throw new GrantBankImportError(error instanceof Error ? error.message : "This import already has three bank statements.", 409); }
      const data = { ...metadataData(input.metadata), fileAssetId: file.id, extractionStatus: "PENDING" as const, extractionStartedAt: null, extractionCompletedAt: null, extractionConfidence: null };
      const statement = current
        ? await tx.grantBankStatement.update({ where: { id: current.id }, data })
        : await tx.grantBankStatement.create({ data: { ...data, batchId: batch.id } });
      const previousFile = current ? { id: current.fileAssetId, uploadedByUserId: current.file.uploadedByUserId } : null;
      await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: current ? "grant.bank_statement.replaced" : "grant.bank_statement.uploaded", entityType: "GrantBankStatement", entityId: statement.id, metadata: { reportId: input.reportId, importId: input.importId, mimeType: file.mimeType, fileSize: file.fileSize } } });
      const updated = await findGrantBankImport(tx, input.reportId, input.importId);
      if (!updated) throw new GrantBankImportError("The bank import could not be reloaded.", 500);
      return { workspace: toWorkspaceDto(updated, context.version.reportType, reportIsEditable(context)), previousFile };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.previousFile?.uploadedByUserId) {
      await storage.rollbackStagedFileAsset({ fileAssetId: result.previousFile.id, uploadedByUserId: result.previousFile.uploadedByUserId, module: "funding", ownerId: result.previousFile.uploadedByUserId, entityId: input.importId }).catch(() => console.error("Old bank statement cleanup failed after replacement.", { statementId: input.metadata.replaceStatementId }));
    }
    return result.workspace;
  } catch (error) {
    await storage.rollbackStagedFileAsset({ fileAssetId: file.id, uploadedByUserId: input.actorUserId, module: "funding", ownerId: input.actorUserId, entityId: input.importId }).catch(() => console.error("Bank statement upload rollback failed.", { fileAssetId: file.id }));
    throw error;
  }
}

export async function updateGrantBankStatementMetadata(input: { reportId: string; importId: string; statementId: string; actorUserId: string; metadata: GrantBankStatementMetadataInput }) {
  return prisma.$transaction(async (tx) => {
    const { context, batch } = await requireMutableBatch(tx, input);
    const statement = batch.statements.find((item) => item.id === input.statementId);
    if (!statement) throw new GrantBankImportError("Bank statement not found.", 404);
    if (statement.extractionStatus !== "PENDING" || statement._count.transactions > 0 || statement._count.processingAttempts > 0) throw new GrantBankImportError("Statement details cannot be changed after processing starts.", 409);
    await tx.grantBankStatement.update({ where: { id: statement.id }, data: metadataData(input.metadata) });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "grant.bank_statement.metadata.updated", entityType: "GrantBankStatement", entityId: statement.id, metadata: { reportId: input.reportId, importId: input.importId } } });
    const updated = await findGrantBankImport(tx, input.reportId, input.importId);
    if (!updated) throw new GrantBankImportError("The bank import could not be reloaded.", 500);
    return toWorkspaceDto(updated, context.version.reportType, reportIsEditable(context));
  });
}

export async function removeGrantBankStatement(input: { reportId: string; importId: string; statementId: string; actorUserId: string }) {
  const removed = await prisma.$transaction(async (tx) => {
    const { context, batch } = await requireMutableBatch(tx, input);
    const statement = batch.statements.find((item) => item.id === input.statementId);
    if (!statement) throw new GrantBankImportError("Bank statement not found.", 404);
    if (statement.extractionStatus !== "PENDING" || statement._count.transactions > 0 || statement._count.processingAttempts > 0) throw new GrantBankImportError("This statement can no longer be removed.", 409);
    await tx.grantBankStatement.delete({ where: { id: statement.id } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "grant.bank_statement.removed", entityType: "GrantBankStatement", entityId: statement.id, metadata: { reportId: input.reportId, importId: input.importId } } });
    const updated = await findGrantBankImport(tx, input.reportId, input.importId);
    if (!updated) throw new GrantBankImportError("The bank import could not be reloaded.", 500);
    return { workspace: toWorkspaceDto(updated, context.version.reportType, reportIsEditable(context)), fileAssetId: statement.fileAssetId, uploadedByUserId: statement.file.uploadedByUserId };
  });
  if (removed.uploadedByUserId) {
    await storage.rollbackStagedFileAsset({ fileAssetId: removed.fileAssetId, uploadedByUserId: removed.uploadedByUserId, module: "funding", ownerId: removed.uploadedByUserId, entityId: input.importId });
  }
  return removed.workspace;
}

async function loadStatementFile(input: { reportId: string; importId: string; statementId: string; actorUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const context = await requireActorAndContext(tx, input.actorUserId, input.reportId);
    const batch = await findGrantBankImport(tx, input.reportId, input.importId);
    if (!batch) throw new GrantBankImportError("Bank statement import not found.", 404);
    assertGrantBankImportAlignment(batch, context);
    const statement = batch.statements.find((item) => item.id === input.statementId);
    if (!statement) throw new GrantBankImportError("Bank statement not found.", 404);
    return statement;
  });
}

export async function getGrantBankStatementFile(input: { reportId: string; importId: string; statementId: string; actorUserId: string; mode: "preview" | "download" }): Promise<SignedFileAccess> {
  const statement = await loadStatementFile(input);
  const context = { actorUserId: input.actorUserId, module: "funding" as const, entityId: input.importId };
  return input.mode === "preview"
    ? storage.createPreviewAccess({ fileAssetId: statement.fileAssetId, context })
    : storage.createDownloadAccess({ fileAssetId: statement.fileAssetId, context });
}
