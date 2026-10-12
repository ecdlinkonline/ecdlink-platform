import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { GrantReportExportLimitError, grantReportExportLimits } from "@/lib/grant-report-export/limits";
import { getGrantReportVersionExportData, getGrantReportVersionExportSource, UnsupportedGrantReportExportTypeError } from "@/lib/grant-report-export/repository";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function core(status: "DRAFT" | "SUBMITTED" = "DRAFT", reportType = "QUARTERLY_CASH_FLOW"): any {
  return {
    id: "version-selected", grantReportId: "report-1", versionNumber: status === "DRAFT" ? 2 : 1, status, reportType,
    reportingPeriodStart: new Date("2026-07-01T00:00:00.000Z"), reportingPeriodEnd: new Date("2026-09-30T00:00:00.000Z"),
    financialYear: "2026", quarter: 2, currency: "ZAR",
    fundingReceivedTotal: decimal("500.00"), otherIncomeTotal: decimal("0"), totalIncome: decimal("500"),
    quarterlyExpenditureTotal: decimal("27106.20"), cumulativeExpenditureTotal: decimal("27106.20"),
    totalExpenditure: decimal("27106.20"), surplusDeficit: decimal("-26606.20"),
    openingBankBalance: decimal("47921.28"), closingBankBalance: decimal("37543.61"),
    executiveSummary: null, objectivesNarrative: null, deliverablesNarrative: null, organisationalChanges: null,
    communityChanges: null, challenges: null, lessonsLearned: null, nextSteps: null, financialNarrative: null,
    centreSnapshot: status === "SUBMITTED" ? { centreName: "Historical Centre", npoNumber: "NPO-1" } : null,
    fundingOrganisationSnapshot: status === "SUBMITTED" ? { name: "Historical Funder" } : null,
    awardSnapshot: status === "SUBMITTED" ? { awardNumber: "OLD-1", title: "Historical Award", awardedAmount: "1000.00" } : null,
    projectSnapshot: status === "SUBMITTED" ? { title: "Historical Project" } : null,
    submittedAt: status === "SUBMITTED" ? new Date("2026-10-05T10:00:00.000Z") : null,
    submittedBy: status === "SUBMITTED" ? { firstName: "Admin", lastName: "User" } : null,
    report: {
      status, obligation: { title: "Q2 report", type: reportType, dueAt: new Date("2026-10-07T00:00:00.000Z") },
      award: {
        awardNumber: "CURRENT-9", title: "Current Award", awardedAmount: decimal("9999"),
        centre: { centreName: "Current Centre", npoNumber: "CURRENT-NPO" },
        fundingProject: { title: "Current Project" },
        organisations: [{ fundingOrganisation: { name: "Current Funder" }, donorOrganisation: null }],
      },
    },
    indicators: [], beneficiaryBreakdowns: [], racialProfileRows: [], sustainabilityItems: [], certifications: [],
  };
}

function clientFor(selected: ReturnType<typeof core>, options: { indicators?: number; evidence?: Array<Record<string, unknown>> } = {}) {
  const calls: Array<{ model: string; args: Record<string, unknown> }> = [];
  let active = 0;
  let maximumActive = 0;
  selected.indicators = Array.from({ length: options.indicators ?? 0 }, (_, index) => ({
    id: `indicator-${index}`, objective: "Objective", deliverable: null, indicator: "Indicator", baseline: null,
    target: null, achieved: null, status: "NOT_STARTED", progressNarrative: null, meansOfVerification: null,
  }));
  const secondary = async <T>(model: string, args: Record<string, unknown>, result: T) => {
    calls.push({ model, args });
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
    return result;
  };
  const client = {
    grantReportVersion: { findFirst: async (args: Record<string, unknown>) => { calls.push({ model: "version", args }); return selected; } },
    grantReportFinancialLine: { findMany: (args: Record<string, unknown>) => secondary("financial", args, []) },
    grantReportDocument: { findMany: (args: Record<string, unknown>) => secondary("evidence", args, options.evidence ?? []) },
    auditLog: { findFirst: (args: Record<string, unknown>) => secondary("audit", args, selected.status === "SUBMITTED" ? { metadata: { readinessState: "READY", warningAcknowledged: false, readinessWarningSnapshotVersion: 1, readinessWarnings: [] } } : null) },
  };
  return { client, calls, getMaximumActive: () => maximumActive };
}

test("repository selects one exact version with four bounded operations and concurrency three", async () => {
  const mock = clientFor(core());
  const result = await getGrantReportVersionExportData({ reportId: "report-1", versionId: "version-selected" }, mock.client as never);
  assert.equal(mock.calls.length, 4);
  assert.deepEqual(mock.calls[0].args.where, { id: "version-selected", grantReportId: "report-1" });
  assert.equal(mock.getMaximumActive(), 3);
  assert.equal((mock.calls.find((call) => call.model === "financial")?.args.take), grantReportExportLimits.financialLines + 1);
  assert.equal((mock.calls.find((call) => call.model === "evidence")?.args.take), grantReportExportLimits.evidenceItems + 1);
  assert.equal(result?.identity.centreName, "Current Centre");
});

test("submission-pack source keeps private FileAsset references server-side and version scoped", async () => {
  const evidence = [{
    id: "document-1", documentType: "INVOICE", title: "Invoice", description: null,
    originalFilenameSnapshot: "invoice.pdf", mimeTypeSnapshot: "application/pdf", fileSizeSnapshot: 6,
    checksumSnapshot: "a".repeat(64), uploadedAt: new Date("2026-08-01T00:00:00.000Z"),
    fileAssetId: "asset-1",
    file: { storageProvider: "supabase", storageKey: "private/report/version/asset-1/invoice.pdf", originalFilename: "invoice.pdf", mimeType: "application/pdf", fileSize: 6, checksum: "a".repeat(64) },
    indicator: null, financialLine: null,
  }];
  const mock = clientFor(core(), { evidence });
  const source = await getGrantReportVersionExportSource({ reportId: "report-1", versionId: "version-selected" }, mock.client as never);
  assert.equal(source?.data.evidence[0].id, "document-1");
  assert.equal(source?.evidenceFiles[0].storageKey, "private/report/version/asset-1/invoice.pdf");
  const evidenceCall = mock.calls.find((call) => call.model === "evidence");
  assert.deepEqual(evidenceCall?.args.where, { grantReportVersionId: "version-selected" });
  assert.equal(JSON.stringify(source?.data).includes("storageKey"), false);
});

test("submitted historical versions use snapshots and never current award identity", async () => {
  const selected = core("SUBMITTED");
  const mock = clientFor(selected);
  const result = await getGrantReportVersionExportData({ reportId: "report-1", versionId: "version-selected" }, mock.client as never);
  assert.equal(result?.identity.centreName, "Historical Centre");
  assert.equal(result?.identity.awardNumber, "OLD-1");
  assert.equal(result?.identity.projectTitle, "Historical Project");
  assert.equal(result?.identity.leadOrganisation, "Historical Funder");
  assert.equal(result?.readiness.state, "READY");
});

test("missing submitted snapshots are explicit and do not fall back to current data", async () => {
  const selected = core("SUBMITTED");
  selected.centreSnapshot = null;
  selected.awardSnapshot = null;
  const result = await getGrantReportVersionExportData({ reportId: "report-1", versionId: "version-selected" }, clientFor(selected).client as never);
  assert.equal(result?.identity.centreName, null);
  assert.equal(result?.identity.awardNumber, null);
  assert.ok(result?.historicalIntegrity.unavailableSnapshots.includes("centre snapshot"));
});

test("unsupported types and oversized child collections fail clearly before export", async () => {
  await assert.rejects(
    () => getGrantReportVersionExportData({ reportId: "report-1", versionId: "version-selected" }, clientFor(core("DRAFT", "CUSTOM")).client as never),
    UnsupportedGrantReportExportTypeError,
  );
  await assert.rejects(
    () => getGrantReportVersionExportData({ reportId: "report-1", versionId: "version-selected" }, clientFor(core(), { indicators: grantReportExportLimits.indicators + 1 }).client as never),
    (error: unknown) => error instanceof GrantReportExportLimitError && error.limit === "indicators",
  );
});
