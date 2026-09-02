import "server-only";

import { Prisma } from "@prisma/client";

export const grantBankImportInclude = Prisma.validator<Prisma.GrantBankImportBatchInclude>()({
  award: { select: { id: true, awardNumber: true, title: true, currency: true, centreId: true, centre: { select: { centreName: true } } } },
  originatingReport: { select: { id: true, grantAwardId: true } },
  statements: {
    orderBy: [{ statementMonth: "asc" }, { createdAt: "asc" }],
    include: {
      file: { select: { originalFilename: true, mimeType: true, fileSize: true, uploadedByUserId: true } },
      _count: { select: { transactions: true, processingAttempts: true } },
    },
  },
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
    include: grantBankImportInclude,
  });
}

export function findEditableGrantBankImport(tx: Prisma.TransactionClient, input: { reportId: string; awardId: string; financialYear: string; quarter: number }) {
  return tx.grantBankImportBatch.findFirst({
    where: { originatingGrantReportId: input.reportId, grantAwardId: input.awardId, financialYear: input.financialYear, quarter: input.quarter, status: { in: ["UPLOADING", "NEEDS_REVIEW", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    include: grantBankImportInclude,
  });
}

export function findGrantBankImport(tx: Prisma.TransactionClient, reportId: string, importId: string) {
  return tx.grantBankImportBatch.findFirst({ where: { id: importId, originatingGrantReportId: reportId }, include: grantBankImportInclude });
}
