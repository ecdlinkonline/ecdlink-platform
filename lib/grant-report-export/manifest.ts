import { createHash } from "node:crypto";
import type { GrantReportExportData } from "@/lib/grant-report-export/types";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}
export function canonicalGrantReportManifestJson(value: unknown) {
  return JSON.stringify(sortValue(value));
}

export function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildGrantReportIntegrityManifest(data: GrantReportExportData, pdf: Buffer, generatedAt: Date) {
  const content = {
    report: {
      id: data.report.id,
      versionId: data.report.versionId,
      versionNumber: data.report.versionNumber,
      reportType: data.report.reportType,
      versionStatus: data.report.versionStatus,
      reportingPeriodStart: data.report.reportingPeriodStart,
      reportingPeriodEnd: data.report.reportingPeriodEnd,
    },
    currency: data.report.currency,
    evidence: data.evidence.map((item) => ({
      documentId: item.id,
      documentType: item.documentType,
      title: item.title,
      originalFilename: item.originalFilename,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      checksumSha256: item.checksum,
      uploadedAt: item.uploadedAt,
      indicatorId: item.indicator?.id ?? null,
      financialLineId: item.financialLine?.id ?? null,
    })),
    historicalIntegrity: data.historicalIntegrity,
  };
  return {
    manifestSchemaVersion: 1,
    content,
    contentSha256: sha256(canonicalGrantReportManifestJson(content)),
    generation: { generatedAt: generatedAt.toISOString() },
    generatedPdf: { sha256: sha256(pdf), sizeBytes: pdf.byteLength },
  };
}

export type GrantReportSubmissionPackEvidenceEntry = {
  documentId: string;
  archivePath: string;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

export function buildGrantReportSubmissionPackManifest(
  data: GrantReportExportData,
  pdf: Buffer,
  evidence: GrantReportSubmissionPackEvidenceEntry[],
  generatedAt: Date,
) {
  const content = {
    report: {
      id: data.report.id,
      versionId: data.report.versionId,
      versionNumber: data.report.versionNumber,
      reportType: data.report.reportType,
      reportStatus: data.report.reportStatus,
      versionStatus: data.report.versionStatus,
      reportingPeriodStart: data.report.reportingPeriodStart,
      reportingPeriodEnd: data.report.reportingPeriodEnd,
    },
    currency: data.report.currency,
    reportPdf: {
      archivePath: "report/ECDLink-Report.pdf",
      sha256: sha256(pdf),
      sizeBytes: pdf.byteLength,
    },
    evidence,
    historicalIntegrity: data.historicalIntegrity,
  };
  return {
    manifestSchemaVersion: 2,
    content,
    contentSha256: sha256(canonicalGrantReportManifestJson(content)),
    generation: { generatedAt: generatedAt.toISOString() },
  };
}
