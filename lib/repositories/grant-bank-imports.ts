import "server-only";

import { Prisma } from "@prisma/client";

export const grantBankImportInclude = Prisma.validator<Prisma.GrantBankImportBatchInclude>()({
  award: { select: { id: true, awardNumber: true, title: true, currency: true, centreId: true, centre: { select: { centreName: true } } } },
  originatingReport: { select: { id: true, grantAwardId: true } },
  statements: {
    orderBy: [{ statementMonth: "asc" }, { createdAt: "asc" }],
    include: {
      file: { select: { originalFilename: true, mimeType: true, fileSize: true, uploadedByUserId: true } },
      transactions: {
        orderBy: [{ transactionDate: "asc" }, { sourcePage: "asc" }, { sourceRow: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          transactionDate: true,
          originalDescription: true,
          originalAmount: true,
          direction: true,
          runningBalance: true,
          sourcePage: true,
          sourceRow: true,
          suggestedType: true,
          suggestedCategory: true,
          suggestedConfidence: true,
          confirmedType: true,
          confirmedCategory: true,
          reviewStatus: true,
          reviewedAt: true,
        },
      },
      processingAttempts: {
        where: { kind: "EXTRACTION" },
        orderBy: [{ attemptNumber: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { status: true, safeFailureCode: true, safeFailureSummary: true },
      },
      _count: { select: { transactions: true, processingAttempts: true } },
    },
  },
});

export const grantBankImportIdentitySelect = Prisma.validator<Prisma.GrantBankImportBatchSelect>()({
  id: true,
  grantAwardId: true,
  centreId: true,
  originatingGrantReportId: true,
  financialYear: true,
  quarter: true,
});

export const grantBankStatementAccessSelect = Prisma.validator<Prisma.GrantBankStatementSelect>()({
  id: true,
  fileAssetId: true,
  batch: { select: grantBankImportIdentitySelect },
});

export type GrantBankImportRecord = Prisma.GrantBankImportBatchGetPayload<{ include: typeof grantBankImportInclude }>;

export async function findActiveSuperAdmin(tx: Prisma.TransactionClient, actorUserId: string) {
  return tx.user.findFirst({ where: { id: actorUserId, role: "SUPER_ADMIN", status: "ACTIVE" }, select: { id: true } });
}

export async function findGrantBankReportContext(tx: Prisma.TransactionClient, reportId: string) {
  const report = await tx.grantReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      currentVersionNumber: true,
      award: { select: { id: true, awardNumber: true, title: true, currency: true, centreId: true, centre: { select: { centreName: true } } } },
      obligation: { select: { financialYear: true, quarter: true, reportingPeriodStart: true, reportingPeriodEnd: true } },
    },
  });
  if (!report) return null;
  const version = await tx.grantReportVersion.findUnique({
    where: { grantReportId_versionNumber: { grantReportId: report.id, versionNumber: report.currentVersionNumber } },
    select: { id: true, status: true, reportType: true, financialYear: true, quarter: true, reportingPeriodStart: true, reportingPeriodEnd: true, currency: true },
  });
  return version ? { ...report, version } : null;
}

export function findConfirmedGrantBankImport(tx: Prisma.TransactionClient, input: { reportId: string; awardId: string; financialYear: string; quarter: number }) {
  return tx.grantBankImportBatch.findFirst({
    where: { originatingGrantReportId: input.reportId, grantAwardId: input.awardId, financialYear: input.financialYear, quarter: input.quarter, status: "CONFIRMED" },
    select: grantBankImportIdentitySelect,
  });
}

export function findEditableGrantBankImport(tx: Prisma.TransactionClient, input: { reportId: string; awardId: string; financialYear: string; quarter: number }) {
  return tx.grantBankImportBatch.findFirst({
    where: { originatingGrantReportId: input.reportId, grantAwardId: input.awardId, financialYear: input.financialYear, quarter: input.quarter, status: { in: ["UPLOADING", "NEEDS_REVIEW", "READY_FOR_CONFIRMATION", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    select: grantBankImportIdentitySelect,
  });
}

export function findGrantBankImport(client: Pick<Prisma.TransactionClient, "grantBankImportBatch">, reportId: string, importId: string) {
  return client.grantBankImportBatch.findFirst({ where: { id: importId, originatingGrantReportId: reportId }, include: grantBankImportInclude });
}

export function findGrantBankStatementForAccess(
  client: Pick<Prisma.TransactionClient, "grantBankStatement">,
  input: { reportId: string; importId: string; statementId: string },
) {
  return client.grantBankStatement.findFirst({
    where: {
      id: input.statementId,
      batchId: input.importId,
      batch: { originatingGrantReportId: input.reportId },
    },
    select: grantBankStatementAccessSelect,
  });
}
