import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertGrantBankImportCapacity, expectedGrantBankStatementMonths, grantBankImportMatchesContext, hasCompleteGrantBankStatementCoverage, isEditableGrantBankImportStatus, isGrantBankImportReportType, type GrantBankImportWorkspaceDto, type GrantBankPostingPreviewDto } from "@/lib/grant-reports/bank-import";
import { bankStatementExtractor, BankStatementExtractionError, bankTransactionFingerprint } from "@/lib/grant-reports/bank-statement-extraction";
import { buildAutomaticGrantBankTransactionConfirmation, buildGrantBankTransactionReviewUpdate, categorisationPresentationStatus, categorisationProgress, grantBankTransactionCategoriser, isGrantBankTransactionCategory, shouldAutoConfirmGrantBankSuggestion, shouldAutoConfirmPersistedGrantBankSuggestion, type GrantBankTransactionCategory } from "@/lib/grant-reports/bank-transaction-categorisation";
import { calculateGrantBankPostingTotals, mapConfirmedTransactionToCashFlow } from "@/lib/grant-reports/bank-transaction-posting";
import { findActiveSuperAdmin, findConfirmedGrantBankImport, findEditableGrantBankImport, findGrantBankImport, findGrantBankReportContext, findGrantBankStatementForAccess, findGrantBankTransactionSources, grantBankImportIdentitySelect, type GrantBankImportRecord } from "@/lib/repositories/grant-bank-imports";
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

function extractionPresentation(statement: GrantBankImportRecord["statements"][number]) {
  const attempt = statement.processingAttempts[0];
  if (statement.extractionStatus === "EXTRACTING") return { state: "PROCESSING" as const, message: "Transaction extraction is in progress." };
  if (attempt?.safeFailureCode === "ocr_required") return { state: "OCR_REQUIRED" as const, message: "This statement requires OCR processing, which is not configured yet." };
  if (attempt?.safeFailureCode === "no_transactions_detected") return { state: "NO_TRANSACTIONS" as const, message: "No transaction rows were detected in the embedded PDF text." };
  if (statement.extractionStatus === "FAILED") return { state: "FAILED" as const, message: attempt?.safeFailureSummary ?? "The statement could not be extracted." };
  if (statement.extractionStatus === "EXTRACTED") return { state: "READY_FOR_CATEGORISATION" as const, message: "Transactions are ready for categorisation." };
  return { state: "PENDING" as const, message: null };
}

function toWorkspaceDto(batch: GrantBankImportRecord, reportType: string, reportEditable = true): GrantBankImportWorkspaceDto {
  if (!isGrantBankImportReportType(reportType)) throw new GrantBankImportError("This report does not support bank statement import.", 422);
  const start = dateOnly(batch.reportingPeriodStart)!;
  const end = dateOnly(batch.reportingPeriodEnd)!;
  const expectedMonths = expectedGrantBankStatementMonths(start, end);
  const allTransactions = batch.statements.flatMap((statement) => statement.transactions);
  const progress = categorisationProgress(allTransactions);
  const allStatementsExtracted = hasCompleteGrantBankStatementCoverage(expectedMonths, batch.statements);
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
    expectedMonths,
    statements: batch.statements.map((statement) => {
      const extraction = extractionPresentation(statement);
      return {
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
        extractionState: extraction.state,
        extractionMessage: extraction.message,
        transactionsFound: statement.transactions.length,
        transactions: statement.transactions.map((transaction) => ({
          id: transaction.id,
          transactionDate: dateOnly(transaction.transactionDate)!,
          description: transaction.originalDescription,
          debit: transaction.direction === "DEBIT" ? transaction.originalAmount.toFixed(2) : null,
          credit: transaction.direction === "CREDIT" ? transaction.originalAmount.toFixed(2) : null,
          balance: transaction.runningBalance?.toFixed(2) ?? null,
          sourcePage: transaction.sourcePage,
          sourceRow: transaction.sourceRow,
          suggestedCategory: isGrantBankTransactionCategory(transaction.suggestedCategory) ? transaction.suggestedCategory : null,
          suggestedConfidence: transaction.suggestedConfidence !== null ? Number(transaction.suggestedConfidence) : null,
          confirmedCategory: isGrantBankTransactionCategory(transaction.confirmedCategory) ? transaction.confirmedCategory : null,
          reviewStatus: categorisationPresentationStatus(transaction),
          reviewedAt: transaction.reviewedAt?.toISOString() ?? null,
        })),
      };
    }),
    categorisation: {
      ...progress,
      readyToComplete: progress.readyToComplete && allStatementsExtracted,
      complete: ["READY_FOR_CONFIRMATION", "CONFIRMED"].includes(batch.status),
    },
  };
}

export async function createOrResumeGrantBankImport(reportId: string, actorUserId: string, client: Pick<typeof prisma, "$transaction" | "grantBankImportBatch"> = prisma) {
  const resolved = await client.$transaction(async (tx) => {
    const context = await requireActorAndContext(tx, actorUserId, reportId);
    const period = reportPeriod(context);
    const lookup = { reportId, awardId: context.award.id, financialYear: period.financialYear, quarter: period.quarter };
    const confirmed = await findConfirmedGrantBankImport(tx, lookup);
    if (confirmed) {
      assertGrantBankImportAlignment(confirmed, context);
      return { batchId: confirmed.id, reportType: context.version.reportType, reportEditable: reportIsEditable(context) };
    }
    const existing = await findEditableGrantBankImport(tx, lookup);
    if (existing) {
      assertGrantBankImportAlignment(existing, context);
      return { batchId: existing.id, reportType: context.version.reportType, reportEditable: reportIsEditable(context) };
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
      select: grantBankImportIdentitySelect,
    });
    await tx.auditLog.create({ data: { actorUserId, action: "grant.bank_import.created", entityType: "GrantBankImportBatch", entityId: batch.id, metadata: { reportId, grantAwardId: context.award.id, centreId: context.award.centreId, financialYear: period.financialYear, quarter: period.quarter } } });
    return { batchId: batch.id, reportType: context.version.reportType, reportEditable: reportIsEditable(context) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  // Hydration includes extraction rows and must not consume the mutation transaction's lifetime.
  const batch = await findGrantBankImport(client, reportId, resolved.batchId);
  if (!batch) throw new GrantBankImportError("The bank import could not be reloaded.", 500);
  return toWorkspaceDto(batch, resolved.reportType, resolved.reportEditable);
}

export async function getGrantBankImportWorkspace(input: { reportId: string; importId: string; actorUserId: string }) {
  // This read-only workspace does not require an interactive transaction.
  const context = await requireActorAndContext(prisma, input.actorUserId, input.reportId);
  const batch = await findGrantBankImport(prisma, input.reportId, input.importId);
  if (!batch) throw new GrantBankImportError("Bank statement import not found.", 404);
  assertGrantBankImportAlignment(batch, context);
  return toWorkspaceDto(batch, context.version.reportType, reportIsEditable(context));
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
  const context = await requireActorAndContext(prisma, input.actorUserId, input.reportId);
  const statement = await findGrantBankStatementForAccess(prisma, input);
  if (!statement) throw new GrantBankImportError("Bank statement not found.", 404);
  assertGrantBankImportAlignment(statement.batch, context);
  return statement;
}

export async function getGrantBankStatementFile(input: { reportId: string; importId: string; statementId: string; actorUserId: string; mode: "preview" | "download" }): Promise<SignedFileAccess> {
  const statement = await loadStatementFile(input);
  const context = { actorUserId: input.actorUserId, module: "funding" as const, entityId: input.importId };
  return input.mode === "preview"
    ? storage.createPreviewAccess({ fileAssetId: statement.fileAssetId, context })
    : storage.createDownloadAccess({ fileAssetId: statement.fileAssetId, context });
}

function extractionFailure(error: unknown) {
  if (error instanceof BankStatementExtractionError) return { code: error.safeCode, summary: error.message };
  return { code: "extraction_failed", summary: "The statement could not be extracted." };
}

export function canStartGrantBankStatementExtraction(input: {
  extractionStatus: string;
  transactionCount: number;
  latestSafeFailureCode?: string | null;
}) {
  if (input.transactionCount > 0) return false;
  if (["PENDING", "FAILED"].includes(input.extractionStatus)) return true;
  return input.extractionStatus === "NEEDS_REVIEW" && input.latestSafeFailureCode === "no_transactions_detected";
}

export async function extractGrantBankStatement(input: { reportId: string; importId: string; statementId: string; actorUserId: string }) {
  const started = await prisma.$transaction(async (tx) => {
    const { batch } = await requireMutableBatch(tx, input);
    const statement = batch.statements.find((item) => item.id === input.statementId);
    if (!statement) throw new GrantBankImportError("Bank statement not found.", 404);
    if (!canStartGrantBankStatementExtraction({
      extractionStatus: statement.extractionStatus,
      transactionCount: statement._count.transactions,
      latestSafeFailureCode: statement.processingAttempts[0]?.safeFailureCode,
    })) {
      throw new GrantBankImportError("This statement cannot be extracted again.", 409);
    }
    const attemptNumber = await tx.grantBankProcessingAttempt.count({ where: { statementId: statement.id, kind: "EXTRACTION" } }) + 1;
    const attempt = await tx.grantBankProcessingAttempt.create({
      data: { batchId: batch.id, statementId: statement.id, kind: "EXTRACTION", providerName: "pending", providerVersion: "1", attemptNumber, status: "RUNNING", startedAt: new Date() },
      select: { id: true },
    });
    await tx.grantBankStatement.update({ where: { id: statement.id }, data: { extractionStatus: "EXTRACTING", extractionStartedAt: new Date(), extractionCompletedAt: null } });
    await tx.grantBankImportBatch.update({ where: { id: batch.id }, data: { status: "EXTRACTING", safeFailureCode: null, safeFailureSummary: null } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "grant.bank_statement.extraction.started", entityType: "GrantBankStatement", entityId: statement.id, metadata: { reportId: input.reportId, importId: input.importId, attemptNumber } } });
    return { attemptId: attempt.id, fileAssetId: statement.fileAssetId, statementMonth: dateOnly(statement.statementMonth) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });

  try {
    const file = await storage.readFileForProcessing(started.fileAssetId);
    const result = await bankStatementExtractor.extract({ content: file.content, mimeType: file.mimeType, statementMonth: started.statementMonth });
    const transactions = result.transactions.filter((transaction) => transaction.transactionDate !== null);
    return await prisma.$transaction(async (tx) => {
      const context = await requireActorAndContext(tx, input.actorUserId, input.reportId);
      const batch = await findGrantBankImport(tx, input.reportId, input.importId);
      if (!batch) throw new GrantBankImportError("Bank statement import not found.", 404);
      assertGrantBankImportAlignment(batch, context);
      const statement = batch.statements.find((item) => item.id === input.statementId);
      if (!statement || statement.extractionStatus !== "EXTRACTING") throw new GrantBankImportError("The extraction state changed before it could be saved.", 409);
      if (transactions.length > 0) {
        await tx.grantBankTransaction.createMany({
          data: transactions.map((transaction) => ({
            batchId: batch.id,
            statementId: statement.id,
            transactionDate: new Date(`${transaction.transactionDate}T00:00:00.000Z`),
            originalDescription: transaction.description,
            originalAmount: transaction.amount,
            direction: transaction.debit !== null ? "DEBIT" as const : "CREDIT" as const,
            runningBalance: transaction.balance,
            sourcePage: transaction.sourcePage,
            sourceRow: transaction.sourceRow,
            sourceReference: transaction.rawText,
            extractionConfidence: transaction.confidence,
            transactionFingerprint: bankTransactionFingerprint(statement.id, transaction),
          })),
        });
      }
      const safeCode = result.state === "OCR_REQUIRED" ? "ocr_required" : result.state === "NO_TRANSACTIONS" ? "no_transactions_detected" : null;
      const safeSummary = result.state === "OCR_REQUIRED" ? "OCR processing is required and is not configured." : result.state === "NO_TRANSACTIONS" ? "No transaction rows were detected." : null;
      await tx.grantBankProcessingAttempt.update({ where: { id: started.attemptId }, data: { providerName: result.providerName, providerVersion: result.providerVersion, status: "SUCCEEDED", safeFailureCode: safeCode, safeFailureSummary: safeSummary, completedAt: new Date() } });
      await tx.grantBankStatement.update({
        where: { id: statement.id },
        data: {
          extractionStatus: result.state === "EXTRACTED" ? "EXTRACTED" : "NEEDS_REVIEW",
          extractionCompletedAt: new Date(),
          periodStart: statement.periodStart ?? (result.statementSummary?.periodStart ? new Date(`${result.statementSummary.periodStart}T00:00:00.000Z`) : null),
          periodEnd: statement.periodEnd ?? (result.statementSummary?.periodEnd ? new Date(`${result.statementSummary.periodEnd}T00:00:00.000Z`) : null),
          openingBalance: statement.openingBalance ?? result.statementSummary?.openingBalance,
          closingBalance: statement.closingBalance ?? result.statementSummary?.closingBalance,
        },
      });
      await tx.grantBankImportBatch.update({ where: { id: batch.id }, data: { status: "NEEDS_REVIEW", safeFailureCode: null, safeFailureSummary: null } });
      await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: result.state === "EXTRACTED" ? "grant.bank_statement.extracted" : "grant.bank_statement.extraction.review_required", entityType: "GrantBankStatement", entityId: statement.id, metadata: { reportId: input.reportId, importId: input.importId, extractionState: result.state, transactionsFound: transactions.length, providerName: result.providerName } } });
      const updated = await findGrantBankImport(tx, input.reportId, input.importId);
      if (!updated) throw new GrantBankImportError("The bank import could not be reloaded.", 500);
      return toWorkspaceDto(updated, context.version.reportType, reportIsEditable(context));
    }, { timeout: 15_000 });
  } catch (error) {
    const failure = extractionFailure(error);
    await prisma.$transaction(async (tx) => {
      await tx.grantBankProcessingAttempt.update({ where: { id: started.attemptId }, data: { status: "FAILED", safeFailureCode: failure.code, safeFailureSummary: failure.summary, completedAt: new Date() } });
      await tx.grantBankStatement.update({ where: { id: input.statementId }, data: { extractionStatus: "FAILED", extractionCompletedAt: new Date() } });
      await tx.grantBankImportBatch.update({ where: { id: input.importId }, data: { status: "FAILED", safeFailureCode: failure.code, safeFailureSummary: failure.summary } });
      await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "grant.bank_statement.extraction.failed", entityType: "GrantBankStatement", entityId: input.statementId, metadata: { reportId: input.reportId, importId: input.importId, safeFailureCode: failure.code } } });
    });
    throw new GrantBankImportError(failure.summary, 422);
  }
}

export async function suggestGrantBankTransactionCategories(input: { reportId: string; importId: string; actorUserId: string }) {
  const context = await requireActorAndContext(prisma, input.actorUserId, input.reportId);
  const current = await findGrantBankImport(prisma, input.reportId, input.importId);
  if (!current) throw new GrantBankImportError("Bank statement import not found.", 404);
  assertEditableBatch(current, context);
  const candidates = current.statements
    .flatMap((statement) => statement.transactions)
    .filter((transaction) => transaction.reviewStatus !== "REVIEWED");
  if (candidates.length === 0) return toWorkspaceDto(current, context.version.reportType, reportIsEditable(context));

  const suggestions = await Promise.all(candidates.map(async (transaction) => ({
    transactionId: transaction.id,
    suggestion: await grantBankTransactionCategoriser.suggest({
      description: transaction.originalDescription,
      direction: transaction.direction,
      amount: Number(transaction.originalAmount),
    }),
  })));

  return prisma.$transaction(async (tx) => {
    const { context: revalidatedContext, batch } = await requireMutableBatch(tx, input);
    const transactionsById = new Map(batch.statements.flatMap((statement) => statement.transactions).map((transaction) => [transaction.id, transaction]));
    let applied = 0;
    let needsReview = 0;
    let automaticallyConfirmed = 0;
    for (const item of suggestions) {
      const transaction = transactionsById.get(item.transactionId);
      if (!transaction || transaction.reviewStatus === "REVIEWED") continue;
      const hasPersistedSuggestion = Boolean(transaction.suggestedCategory);
      const autoConfirm = hasPersistedSuggestion
        ? shouldAutoConfirmPersistedGrantBankSuggestion(transaction, item.suggestion)
        : shouldAutoConfirmGrantBankSuggestion(item.suggestion);
      if (hasPersistedSuggestion && !autoConfirm) continue;
      await tx.grantBankTransaction.update({
        where: { id: transaction.id },
        data: {
          ...(hasPersistedSuggestion ? {} : {
            suggestedType: item.suggestion.type,
            suggestedCategory: item.suggestion.category,
            suggestedConfidence: item.suggestion.confidence,
            reviewStatus: item.suggestion.requiresReview ? "NEEDS_REVIEW" as const : "UNREVIEWED" as const,
          }),
          ...buildAutomaticGrantBankTransactionConfirmation(item.suggestion),
        },
      });
      applied += 1;
      if (!hasPersistedSuggestion && item.suggestion.requiresReview) needsReview += 1;
      if (autoConfirm) automaticallyConfirmed += 1;
    }
    const attemptedAt = new Date();
    const attemptNumber = await tx.grantBankProcessingAttempt.count({ where: { batchId: batch.id, kind: "CLASSIFICATION" } }) + 1;
    await tx.grantBankProcessingAttempt.create({
      data: {
        batchId: batch.id,
        kind: "CLASSIFICATION",
        providerName: [...new Set(suggestions.map((item) => item.suggestion.providerName))].join(","),
        providerVersion: "1",
        attemptNumber,
        status: "SUCCEEDED",
        startedAt: attemptedAt,
        completedAt: attemptedAt,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "grant.bank_transactions.categorisation.suggested",
        entityType: "GrantBankImportBatch",
        entityId: batch.id,
        metadata: { reportId: input.reportId, transactionsConsidered: suggestions.length, suggestionsApplied: applied, needsReview, automaticallyConfirmed },
      },
    });
    if (automaticallyConfirmed > 0) {
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "grant.bank_transactions.categorisation.auto_confirmed",
          entityType: "GrantBankImportBatch",
          entityId: batch.id,
          metadata: { reportId: input.reportId, automaticallyConfirmed, providerName: "deterministic-rules", confidenceThreshold: 0.9 },
        },
      });
    }
    const updated = await findGrantBankImport(tx, input.reportId, input.importId);
    if (!updated) throw new GrantBankImportError("The bank import could not be reloaded.", 500);
    return toWorkspaceDto(updated, revalidatedContext.version.reportType, reportIsEditable(revalidatedContext));
  }, { timeout: 15_000 });
}

export async function confirmGrantBankTransactionCategory(input: {
  reportId: string;
  importId: string;
  transactionId: string;
  category: GrantBankTransactionCategory;
  actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const { context, batch } = await requireMutableBatch(tx, input);
    const transaction = batch.statements.flatMap((statement) => statement.transactions).find((candidate) => candidate.id === input.transactionId);
    if (!transaction) throw new GrantBankImportError("Bank transaction not found.", 404);
    const reviewedAt = new Date();
    const update = buildGrantBankTransactionReviewUpdate({ category: input.category, actorUserId: input.actorUserId, reviewedAt });
    await tx.grantBankTransaction.update({ where: { id: transaction.id }, data: update });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "grant.bank_transaction.categorisation.confirmed",
        entityType: "GrantBankTransaction",
        entityId: transaction.id,
        before: { confirmedType: transaction.confirmedType, confirmedCategory: transaction.confirmedCategory, reviewStatus: transaction.reviewStatus },
        after: { confirmedType: update.confirmedType, confirmedCategory: update.confirmedCategory, reviewStatus: update.reviewStatus, reviewedAt },
        metadata: { reportId: input.reportId, importId: input.importId, manualOverride: transaction.suggestedCategory !== input.category },
      },
    });
    const updated = await findGrantBankImport(tx, input.reportId, input.importId);
    if (!updated) throw new GrantBankImportError("The bank import could not be reloaded.", 500);
    return toWorkspaceDto(updated, context.version.reportType, reportIsEditable(context));
  }, { timeout: 15_000 });
}

export async function completeGrantBankTransactionCategorisation(input: { reportId: string; importId: string; actorUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const { context, batch } = await requireMutableBatch(tx, input);
    const expectedMonths = expectedGrantBankStatementMonths(dateOnly(batch.reportingPeriodStart)!, dateOnly(batch.reportingPeriodEnd)!);
    if (!hasCompleteGrantBankStatementCoverage(expectedMonths, batch.statements)) {
      throw new GrantBankImportError("Extract all required bank statements before completing categorisation.", 409);
    }
    const progress = categorisationProgress(batch.statements.flatMap((statement) => statement.transactions));
    if (!progress.readyToComplete) {
      throw new GrantBankImportError(`Review all transactions before completing categorisation. ${progress.remaining} remaining.`, 409);
    }
    await tx.grantBankImportBatch.update({ where: { id: batch.id }, data: { status: "READY_FOR_CONFIRMATION" } });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "grant.bank_import.categorisation.completed",
        entityType: "GrantBankImportBatch",
        entityId: batch.id,
        before: { status: batch.status },
        after: { status: "READY_FOR_CONFIRMATION" },
        metadata: { reportId: input.reportId, transactionsReviewed: progress.reviewed },
      },
    });
    const updated = await findGrantBankImport(tx, input.reportId, input.importId);
    if (!updated) throw new GrantBankImportError("The bank import could not be reloaded.", 500);
    return toWorkspaceDto(updated, context.version.reportType, reportIsEditable(context));
  }, { timeout: 15_000 });
}

function buildGrantBankPostingPreview(
  batch: GrantBankImportRecord,
  context: ReportContext,
  postedTransactionIds: ReadonlySet<string>,
): GrantBankPostingPreviewDto {
  const rows = batch.statements.flatMap((statement) => statement.transactions.map((transaction) => {
    if (transaction.reviewStatus !== "REVIEWED" || !transaction.confirmedType || !transaction.confirmedCategory) {
      throw new GrantBankImportError("Every bank transaction must be confirmed before posting can be reviewed.", 409);
    }
    const mapping = mapConfirmedTransactionToCashFlow({ direction: transaction.direction, confirmedType: transaction.confirmedType, confirmedCategory: transaction.confirmedCategory });
    return {
      transactionId: transaction.id,
      statementId: statement.id,
      statementName: statement.file.originalFilename,
      transactionDate: dateOnly(transaction.transactionDate)!,
      description: transaction.originalDescription,
      direction: transaction.direction,
      amount: transaction.originalAmount.toFixed(2),
      runningBalance: transaction.runningBalance?.toFixed(2) ?? null,
      sourcePage: transaction.sourcePage,
      sourceRow: transaction.sourceRow,
      confirmedType: transaction.confirmedType,
      confirmedCategory: transaction.confirmedCategory,
      ...mapping,
    };
  }));
  const totals = calculateGrantBankPostingTotals(rows.map((row) => ({ direction: row.direction, amount: new Prisma.Decimal(row.amount), mapping: row })));
  const posted = rows.length > 0 && rows.every((row) => postedTransactionIds.has(row.transactionId));
  return {
    reportId: context.id,
    importId: batch.id,
    versionId: context.version.id,
    currency: batch.currency,
    status: batch.status,
    posted,
    canPost: batch.status === "READY_FOR_CONFIRMATION" && rows.length > 0 && totals.unmapped === 0 && postedTransactionIds.size === 0 && reportIsEditable(context),
    rows,
    totals: {
      confirmedCredits: totals.confirmedCredits.toFixed(2),
      confirmedDebits: totals.confirmedDebits.toFixed(2),
      proposedCashReceived: totals.proposedCashReceived.toFixed(2),
      proposedOperatingExpenses: totals.proposedOperatingExpenses.toFixed(2),
      netMovement: totals.netMovement.toFixed(2),
      unmapped: totals.unmapped,
    },
  };
}

async function loadGrantBankPostingContext(tx: Prisma.TransactionClient, input: { reportId: string; importId: string; actorUserId: string }) {
  const context = await requireActorAndContext(tx, input.actorUserId, input.reportId);
  if (context.version.reportType !== "QUARTERLY_CASH_FLOW") throw new GrantBankImportError("Bank transactions can be posted only to a Quarterly Cash Flow report.", 422);
  const batch = await findGrantBankImport(tx, input.reportId, input.importId);
  if (!batch) throw new GrantBankImportError("Bank statement import not found.", 404);
  assertGrantBankImportAlignment(batch, context);
  if (!["READY_FOR_CONFIRMATION", "CONFIRMED"].includes(batch.status)) throw new GrantBankImportError("Complete transaction categorisation before reviewing report posting.", 409);
  const sources = await findGrantBankTransactionSources(tx, context.version.id);
  return { context, batch, sources };
}

export async function getGrantBankPostingPreview(input: { reportId: string; importId: string; actorUserId: string }) {
  const { context, batch, sources } = await loadGrantBankPostingContext(prisma, input);
  return buildGrantBankPostingPreview(batch, context, new Set(sources.map((source) => source.grantBankTransactionId)));
}

export async function postGrantBankTransactionsToCashFlow(
  input: { reportId: string; importId: string; actorUserId: string },
  client: Pick<typeof prisma, "$transaction"> = prisma,
) {
  return client.$transaction(async (tx) => {
    const { context, batch, sources } = await loadGrantBankPostingContext(tx, input);
    const preview = buildGrantBankPostingPreview(batch, context, new Set(sources.map((source) => source.grantBankTransactionId)));
    if (preview.posted && batch.status === "CONFIRMED") return preview;
    if (batch.status !== "READY_FOR_CONFIRMATION") throw new GrantBankImportError("This bank import is not ready to post.", 409);
    if (!reportIsEditable(context)) throw new GrantBankImportError("The current report version is no longer editable.", 409);
    if (sources.length > 0) throw new GrantBankImportError("Some bank transactions are already linked to this report version. No partial repost was performed.", 409);
    if (!preview.canPost) throw new GrantBankImportError("Resolve every posting review item before posting to the report.", 409);

    const groups = new Map<string, typeof preview.rows>();
    for (const row of preview.rows) {
      const key = `${row.lineType}:${row.reportCategory}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const lastLine = await tx.grantReportFinancialLine.findFirst({ where: { grantReportVersionId: context.version.id }, orderBy: { displayOrder: "desc" }, select: { displayOrder: true } });
    let displayOrder = (lastLine?.displayOrder ?? -1) + 1;
    for (const rows of groups.values()) {
      const first = rows[0];
      if (!first.lineType || !first.reportCategory) throw new GrantBankImportError("A posting group is missing its report mapping.", 409);
      const amount = rows.reduce((total, row) => total.plus(row.amount), new Prisma.Decimal(0));
      const expenditure = first.lineType === "EXPENDITURE";
      const line = await tx.grantReportFinancialLine.create({
        data: {
          grantReportVersionId: context.version.id,
          lineType: first.lineType,
          categoryCode: `BANK_IMPORT:${batch.id}:${first.lineType}:${first.reportCategory}`,
          categoryName: first.reportCategory,
          description: "Posted from confirmed bank statement transactions.",
          displayOrder: displayOrder++,
          quarterlyActual: amount,
          estimatedExpenditure: expenditure ? amount : null,
          variance: expenditure ? amount.negated() : null,
          reasonForVariance: expenditure ? "Actual expenditure posted from confirmed bank transactions; quarterly budget remains unchanged." : null,
        },
        select: { id: true },
      });
      await tx.grantReportBankTransactionSource.createMany({ data: rows.map((row) => ({
        grantReportVersionId: context.version.id,
        grantReportFinancialLineId: line.id,
        grantBankTransactionId: row.transactionId,
        appliedAmount: row.amount,
        transactionTypeSnapshot: row.confirmedType,
        categorySnapshot: row.confirmedCategory,
        descriptionSnapshot: row.description,
        appliedByUserId: input.actorUserId,
      })) });
    }

    const financialLines = await tx.grantReportFinancialLine.findMany({ where: { grantReportVersionId: context.version.id }, select: { lineType: true, quarterlyActual: true, estimatedExpenditure: true } });
    const fundingReceivedTotal = financialLines.filter((line) => line.lineType === "FUNDING_RECEIVED").reduce((sum, line) => sum.plus(line.quarterlyActual ?? 0), new Prisma.Decimal(0));
    const otherIncomeTotal = financialLines.filter((line) => line.lineType === "OTHER_INCOME").reduce((sum, line) => sum.plus(line.quarterlyActual ?? 0), new Prisma.Decimal(0));
    const totalExpenditure = financialLines.filter((line) => line.lineType === "EXPENDITURE").reduce((sum, line) => sum.plus(line.estimatedExpenditure ?? line.quarterlyActual ?? 0), new Prisma.Decimal(0));
    const totalIncome = fundingReceivedTotal.plus(otherIncomeTotal);
    await tx.grantReportVersion.update({ where: { id: context.version.id }, data: { fundingReceivedTotal, otherIncomeTotal, totalIncome, quarterlyExpenditureTotal: totalExpenditure, totalExpenditure, surplusDeficit: totalIncome.minus(totalExpenditure) } });
    await tx.grantBankImportBatch.update({ where: { id: batch.id }, data: { status: "CONFIRMED", confirmedByUserId: input.actorUserId, confirmedAt: new Date() } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "grant.bank_import.transactions.posted", entityType: "GrantBankImportBatch", entityId: batch.id, metadata: { reportId: input.reportId, versionId: context.version.id, transactionCount: preview.rows.length, confirmedCredits: preview.totals.confirmedCredits, confirmedDebits: preview.totals.confirmedDebits, proposedCashReceived: preview.totals.proposedCashReceived, proposedOperatingExpenses: preview.totals.proposedOperatingExpenses } } });
    const updated = await findGrantBankImport(tx, input.reportId, input.importId);
    if (!updated) throw new GrantBankImportError("The posted bank import could not be reloaded.", 500);
    return buildGrantBankPostingPreview(updated, context, new Set(updated.statements.flatMap((statement) => statement.transactions.map((transaction) => transaction.id))));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
}

export async function returnGrantBankImportToCategorisation(input: { reportId: string; importId: string; actorUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const { context, batch, sources } = await loadGrantBankPostingContext(tx, input);
    if (!reportIsEditable(context)) throw new GrantBankImportError("The current report version is no longer editable.", 409);
    if (batch.status !== "READY_FOR_CONFIRMATION" || sources.length > 0) throw new GrantBankImportError("This bank import can no longer return to categorisation.", 409);
    await tx.grantBankImportBatch.update({ where: { id: batch.id }, data: { status: "NEEDS_REVIEW" } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "grant.bank_import.posting.review_returned", entityType: "GrantBankImportBatch", entityId: batch.id, before: { status: batch.status }, after: { status: "NEEDS_REVIEW" }, metadata: { reportId: input.reportId, versionId: context.version.id } } });
    const updated = await findGrantBankImport(tx, input.reportId, input.importId);
    if (!updated) throw new GrantBankImportError("The bank import could not be reloaded.", 500);
    return toWorkspaceDto(updated, context.version.reportType, reportIsEditable(context));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
}
