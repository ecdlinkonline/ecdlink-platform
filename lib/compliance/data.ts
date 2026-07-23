import { seededCentres } from "@/lib/centres/seed";
import {
  complianceRequirementSeed,
  formatComplianceDate,
  getScoreLight,
  renewalReminderOptions,
} from "@/lib/compliance/format";
import type {
  CentreComplianceRecord,
  ComplianceDocumentRecord,
  ComplianceDocumentStatus,
  ComplianceDocumentType,
} from "@/lib/compliance/types";

export const complianceDocumentTypes =
  complianceRequirementSeed as unknown as ComplianceDocumentType[];

export {
  formatComplianceDate,
  getScoreLight,
  renewalReminderOptions,
};

const statusPattern: ComplianceDocumentStatus[] = [
  "Verified",
  "Uploaded",
  "Verified",
  "Expiring Soon",
  "Verified",
  "Missing",
  "Uploaded",
  "Missing",
  "Verified",
  "Uploaded",
  "Expired",
  "Verified",
  "Missing",
  "Rejected",
  "Uploaded",
];

const statusScore: Record<ComplianceDocumentStatus, number> = {
  Verified: 100,
  Uploaded: 72,
  "Expiring Soon": 58,
  Missing: 0,
  Expired: 10,
  Rejected: 18,
  Archived: 0,
};

function documentDate(
  index: number,
  centreIndex: number,
  status: ComplianceDocumentStatus
) {
  if (
    status === "Missing" ||
    status === "Rejected" ||
    status === "Archived"
  ) {
    return null;
  }

  if (status === "Expired") {
    return "2026-05-31";
  }

  if (status === "Expiring Soon") {
    return "2026-08-15";
  }

  return `2027-${String((index % 9) + 1).padStart(2, "0")}-28`;
}

function buildDocuments(
  centreId: string,
  centreIndex: number
): ComplianceDocumentRecord[] {
  return complianceDocumentTypes.map((type, index) => {
    let status =
      statusPattern[
        (index + centreIndex) % statusPattern.length
      ];

    if (
      centreIndex % 4 === 1 &&
      (status === "Missing" || status === "Rejected")
    ) {
      status = "Verified";
    }

    if (
      centreIndex % 5 === 0 &&
      status === "Uploaded"
    ) {
      status = "Missing";
    }

    if (
      centreIndex % 6 === 2 &&
      status === "Expiring Soon"
    ) {
      status = "Expired";
    }

    const uploaded =
      status !== "Missing" && status !== "Archived"
        ? `2026-0${(index % 6) + 1}-12`
        : null;

    const expiryDate = documentDate(
      index,
      centreIndex,
      status
    );

    return {
      id: `${centreId}-${type
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}`,
      type,
      status,
      expiryDate,
      uploadedAt: uploaded,
      fileName: uploaded
        ? `${centreId}-${type
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")}.pdf`
        : null,
      verificationNote:
        status === "Verified"
          ? "Verified by ECDLink compliance desk."
          : status === "Rejected"
            ? "Document must be replaced with a clearer or valid copy."
            : status === "Missing"
              ? "Upload required before the centre can be marked funding-ready."
              : status === "Archived"
                ? "Document has been archived and is no longer active."
                : "Awaiting final admin verification.",
      reminderDate: expiryDate ? "2026-07-25" : null,
    };
  });
}

export const complianceRecords: CentreComplianceRecord[] =
  seededCentres.slice(0, 16).map(
    (centre, centreIndex) => {
      const documents = buildDocuments(
        centre.id,
        centreIndex
      );

      const score = Math.round(
        documents.reduce(
          (sum, document) =>
            sum + statusScore[document.status],
          0
        ) / documents.length
      );

      return {
        id: `compliance-${centre.id}`,
        centreId: centre.id,
        centreName: centre.centreName,
        region: centre.region,
        area: centre.area,
        contactPerson: centre.contactPerson,
        score,
        scoreLight: getScoreLight(score),
        documents,
        adminVerificationNotes: [
          score >= 80
            ? "Strong compliance profile. Keep renewal reminders active."
            : "Compliance follow-up required before funding readiness review.",
          "Procurement and funding modules will consume this readiness score in future workflows.",
        ],
        lastUpdatedAt: "2026-07-10",
      };
    }
  );