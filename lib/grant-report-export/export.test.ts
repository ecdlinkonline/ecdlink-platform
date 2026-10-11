import assert from "node:assert/strict";
import test from "node:test";
import { PDFParse } from "pdf-parse";
import { buildGrantReportExportSections, grantReportExportPresentation } from "@/lib/grant-report-export/adapters";
import { buildGrantReportExportFixture } from "@/lib/grant-report-export/fixtures";
import {
  assertBoundedCount,
  assertExportInputSize,
  GrantReportExportLimitError,
  grantReportExportLimits,
} from "@/lib/grant-report-export/limits";
import { buildGrantReportIntegrityManifest, canonicalGrantReportManifestJson, sha256 } from "@/lib/grant-report-export/manifest";
import { renderGrantReportPdf } from "@/lib/grant-report-export/pdf";

async function readPdf(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer.slice() });
  try {
    return await parser.getText();
  } finally {
    await parser.destroy();
  }
}

test("report-type adapters cover cash flow, expenditure and NLC reports", () => {
  for (const reportType of ["QUARTERLY_CASH_FLOW", "QUARTERLY_EXPENDITURE", "INTERIM", "FINAL"] as const) {
    const sections = buildGrantReportExportSections(buildGrantReportExportFixture({ reportType }));
    assert.ok(sections.length >= 4);
    assert.equal(sections.at(-2)?.title, "Evidence register");
  }
});

test("exact-cent presentation never rounds recorded money to whole Rand", () => {
  assert.equal(grantReportExportPresentation.money("33842.58", "ZAR"), "R33,842.58");
  assert.equal(grantReportExportPresentation.money("27106.20", "ZAR"), "R27,106.20");
  assert.equal(grantReportExportPresentation.money("180", "ZAR"), "R180.00");
  assert.equal(grantReportExportPresentation.money("-598.84", "ZAR"), "-R598.84");
});

test("draft PDF is valid, readable, paginated and visibly watermarked", async () => {
  const pdf = await renderGrantReportPdf(buildGrantReportExportFixture({ reportType: "INTERIM", long: true }), { now: new Date("2026-10-11T00:00:00.000Z") });
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  const result = await readPdf(pdf);
  assert.ok(result.total > 1);
  assert.match(result.text, /DRAFT\s+\u2014\s+NOT\s+SUBMITTED/);
  assert.match(result.text, /R33,842\.58/);
  assert.match(result.text, /Nutrition invoice/);
  assert.match(result.text, /Ikhaya Early Learning Centre/);
});

test("submitted PDF has no draft watermark and preserves submitted identity", async () => {
  const pdf = await renderGrantReportPdf(buildGrantReportExportFixture({ status: "SUBMITTED" }), { now: new Date("2027-01-05T11:00:00.000Z") });
  const result = await readPdf(pdf);
  assert.doesNotMatch(result.text, /DRAFT\s+\u2014\s+NOT\s+SUBMITTED/);
  assert.match(result.text, /Version 1 .* SUBMITTED/);
  assert.match(result.text, /Nomsa Example/);
});

test("missing optional fields render explicitly without breaking the PDF", async () => {
  const data = buildGrantReportExportFixture({ status: "SUBMITTED" });
  data.identity.projectTitle = null;
  data.identity.leadOrganisation = null;
  data.narratives = {
    executiveSummary: null,
    objectives: null,
    deliverables: null,
    organisationalChanges: null,
    communityChanges: null,
    challenges: null,
    lessonsLearned: null,
    nextSteps: null,
    financial: null,
  };
  data.evidence = [];
  data.certifications = [];

  const pdf = await renderGrantReportPdf(data);
  const result = await readPdf(pdf);
  assert.match(result.text, /Historical snapshot unavailable/);
  assert.match(result.text, /No supporting evidence is recorded for this report version/);
  assert.match(result.text, /No certification is recorded for this report version/);
});

test("Q1 through Q4 use persisted periods including Q4 calendar-year rollover", async () => {
  const periods = [
    [1, "2026-04-01T00:00:00.000Z", "2026-06-30T00:00:00.000Z"],
    [2, "2026-07-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z"],
    [3, "2026-10-01T00:00:00.000Z", "2026-12-31T00:00:00.000Z"],
    [4, "2027-01-01T00:00:00.000Z", "2027-03-31T00:00:00.000Z"],
  ] as const;
  for (const [quarter, periodStart, periodEnd] of periods) {
    const pdf = await renderGrantReportPdf(buildGrantReportExportFixture({ quarter, periodStart, periodEnd }));
    const result = await readPdf(pdf);
    assert.match(result.text, new RegExp(`Q${quarter}`));
    assert.ok(result.text.includes(new Date(periodStart).getUTCFullYear().toString()));
    assert.ok(result.text.includes(new Date(periodEnd).getUTCFullYear().toString()));
  }
});

test("manifest is canonical, version scoped and excludes private storage data", async () => {
  const data = buildGrantReportExportFixture({ status: "SUBMITTED" });
  const pdf = Buffer.from("synthetic-pdf");
  const manifest = buildGrantReportIntegrityManifest(data, pdf, new Date("2027-01-05T11:00:00.000Z"));
  assert.equal(manifest.manifestSchemaVersion, 1);
  assert.equal(manifest.content.report.versionId, "version-fixture");
  assert.equal(manifest.generatedPdf.sha256, sha256(pdf));
  assert.equal(manifest.contentSha256, sha256(canonicalGrantReportManifestJson(manifest.content)));
  const encoded = canonicalGrantReportManifestJson(manifest);
  assert.doesNotMatch(encoded, /storageKey|signedUrl|serviceRole|credential|accessToken/i);
  assert.match(encoded, /invoice\.pdf/);
});

test("PDF output limit fails safely", async () => {
  await assert.rejects(
    () => renderGrantReportPdf(buildGrantReportExportFixture(), { maximumBytes: 100 }),
    (error: unknown) => error instanceof GrantReportExportLimitError && error.limit === "generatedPdfBytes",
  );
});

test("PDF generation deadline fails safely", async () => {
  await assert.rejects(
    () => renderGrantReportPdf(buildGrantReportExportFixture(), { maximumMilliseconds: -1 }),
    (error: unknown) => error instanceof GrantReportExportLimitError && error.limit === "generationMilliseconds",
  );
});

test("input memory and bounded collection limits fail safely", () => {
  assert.throws(
    () => assertExportInputSize({ narrative: "x".repeat(grantReportExportLimits.estimatedInputBytes + 1) }),
    (error: unknown) => error instanceof GrantReportExportLimitError && error.limit === "estimatedInputBytes",
  );
  assert.throws(
    () => assertBoundedCount("evidenceItems", grantReportExportLimits.evidenceItems + 1),
    (error: unknown) => error instanceof GrantReportExportLimitError && error.limit === "evidenceItems",
  );
});
