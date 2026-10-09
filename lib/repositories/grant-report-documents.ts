import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const grantReportEvidencePageSize = 20;
export const grantReportEvidenceMaximumPageSize = 50;

export type GrantReportEvidenceListInput = {
  reportId: string;
  versionNumber: number;
  page: number;
  pageSize: number;
};

type GrantReportEvidenceClient = Pick<Prisma.TransactionClient, "grantReportVersion">;

function uploaderName(user: { firstName: string | null; lastName: string | null; email: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Internal user";
}

export async function listGrantReportEvidence(
  input: GrantReportEvidenceListInput,
  client: GrantReportEvidenceClient = prisma,
) {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(grantReportEvidenceMaximumPageSize, Math.max(1, input.pageSize));
  const version = await client.grantReportVersion.findFirst({
    where: { grantReportId: input.reportId, versionNumber: input.versionNumber },
    select: {
      id: true,
      status: true,
      report: { select: { status: true, currentVersionNumber: true } },
      _count: { select: { documents: true } },
      documents: {
        orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          documentType: true,
          title: true,
          description: true,
          originalFilenameSnapshot: true,
          mimeTypeSnapshot: true,
          fileSizeSnapshot: true,
          uploadedAt: true,
          indicator: { select: { id: true, objective: true } },
          financialLine: { select: { id: true, lineType: true, categoryName: true } },
          uploadedBy: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });
  if (!version) return null;

  const total = version._count.documents;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    version: {
      id: version.id,
      versionNumber: input.versionNumber,
      status: version.status,
      editable: version.status === "DRAFT"
        && version.report.currentVersionNumber === input.versionNumber
        && !["SUBMITTED", "APPROVED", "ARCHIVED"].includes(version.report.status),
    },
    documents: version.documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      title: document.title,
      description: document.description,
      originalFilename: document.originalFilenameSnapshot,
      mimeType: document.mimeTypeSnapshot,
      fileSize: document.fileSizeSnapshot,
      uploadedAt: document.uploadedAt.toISOString(),
      uploadedBy: uploaderName(document.uploadedBy),
      indicator: document.indicator ? { id: document.indicator.id, label: document.indicator.objective } : null,
      financialLine: document.financialLine ? {
        id: document.financialLine.id,
        lineType: document.financialLine.lineType,
        label: document.financialLine.categoryName,
      } : null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  };
}

export type GrantReportEvidenceList = NonNullable<Awaited<ReturnType<typeof listGrantReportEvidence>>>;
