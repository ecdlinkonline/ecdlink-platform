import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { createGrantAward, createGrantReportingObligation, GrantReportingServiceError, saveGrantReportSection, type GrantReportingTransactionRunner } from "./grant-reports";
import { createGrantAwardSchema, createGrantReportingObligationSchema, saveGrantReportSectionSchema } from "@/lib/validators/grant-reports";

function runner(transaction: object): GrantReportingTransactionRunner {
  return async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) => operation(transaction as Prisma.TransactionClient);
}

const baseAward = createGrantAwardSchema.parse({
  sourceType: "FUNDING_APPLICATION",
  fundingApplicationId: "application-1",
  centreId: "centre-1",
  fundingProjectId: "project-1",
  awardNumber: "AW-001",
  title: "Nutrition grant",
  awardedAmount: 125000,
  currency: "ZAR",
  startDate: "2026-08-01",
  organisationType: "FUNDING_ORGANISATION",
  fundingOrganisationId: "funder-1",
});

function awardTransaction(applicationOverrides: Record<string, unknown> = {}) {
  const captured: { award?: Record<string, unknown>; party?: Record<string, unknown>; audit?: Record<string, unknown>; audits: Record<string, unknown>[] } = { audits: [] };
  const transaction = {
    fundingProject: { findUnique: async () => ({ id: "project-1", profile: { centreId: "centre-1" } }) },
    fundingApplication: { findUnique: async () => ({ id: "application-1", status: "APPROVED", projectId: "project-1", fundingOrganisationId: "funder-1", grantAward: null, project: { profile: { centreId: "centre-1" } }, ...applicationOverrides }) },
    sponsorshipCommitment: { findUnique: async () => null },
    fundingOrganisation: { findUnique: async () => ({ id: "funder-1" }) },
    donorOrganisation: { findUnique: async () => null },
    fileAsset: { findFirst: async () => ({ id: "file-1", storageKey: "funding/internal-user-1/grant-award-staging/file-1/agreement.pdf", originalFilename: "agreement.pdf", mimeType: "application/pdf", fileSize: 1024, grantAwardSignedAgreement: null }) },
    grantAward: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => { captured.award = data; return { id: "award-1", ...data }; },
    },
    grantAwardOrganisation: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.party = data; return { id: "party-1", ...data }; } },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.audit = data; captured.audits.push(data); return { id: "audit-1" }; } },
  };
  return { transaction, captured };
}

test("a valid approved funding application creates award, lead party and audit atomically with the internal actor", async () => {
  const { transaction, captured } = awardTransaction();
  await createGrantAward(baseAward, "internal-user-1", runner(transaction));
  assert.equal(captured.award?.confirmedByUserId, "internal-user-1");
  assert.equal(captured.party?.addedByUserId, "internal-user-1");
  assert.equal(captured.audit?.actorUserId, "internal-user-1");
  assert.equal(captured.audit?.action, "grant.award.create");
});

test("an optional staged agreement is linked with signed metadata and audited using the internal actor", async () => {
  const input = createGrantAwardSchema.parse({ ...baseAward, signedAgreementFileAssetId: "file-1", signedByBothParties: true, agreementDate: "2026-08-15" });
  const { transaction, captured } = awardTransaction();
  await createGrantAward(input, "internal-user-1", runner(transaction));
  assert.equal(captured.award?.signedAgreementFileAssetId, "file-1");
  assert.equal(captured.award?.signedByBothParties, true);
  assert.deepEqual(captured.award?.agreementDate, new Date("2026-08-15"));
  assert.equal(captured.party?.role, "LEAD_FUNDER");
  assert.deepEqual(captured.audits.map((audit) => audit.action), ["grant.award.create", "grant.award.agreement.attached"]);
  assert.ok(captured.audits.every((audit) => audit.actorUserId === "internal-user-1"));
});

test("duplicate application conversion and mismatched relationships are rejected", async () => {
  const duplicate = awardTransaction({ grantAward: { id: "existing-award" } });
  await assert.rejects(() => createGrantAward(baseAward, "internal-user-1", runner(duplicate.transaction)), (error: unknown) => error instanceof GrantReportingServiceError && error.status === 409);

  for (const overrides of [
    { fundingOrganisationId: "different-funder" },
    { projectId: "different-project" },
    { project: { profile: { centreId: "different-centre" } } },
  ]) {
    const mismatch = awardTransaction(overrides);
    await assert.rejects(() => createGrantAward(baseAward, "internal-user-1", runner(mismatch.transaction)), /relationship does not match/);
  }
});

test("a sponsorship commitment without a linked FundingProject is rejected", async () => {
  const input = createGrantAwardSchema.parse({ ...baseAward, sourceType: "SPONSORSHIP_COMMITMENT", fundingApplicationId: "", sponsorshipCommitmentId: "commitment-1", organisationType: "DONOR_ORGANISATION", fundingOrganisationId: "", donorOrganisationId: "donor-1" });
  const transaction = {
    fundingProject: { findUnique: async () => ({ id: "project-1", profile: { centreId: "centre-1" } }) },
    sponsorshipCommitment: { findUnique: async () => ({ id: "commitment-1", centreId: "centre-1", donorOrganisationId: "donor-1", commitmentStatus: "Confirmed", grantAward: null, project: null }) },
  };
  await assert.rejects(() => createGrantAward(input, "internal-user-1", runner(transaction)), /linked to a FundingProject/);
});

test("obligation creation eagerly creates Draft report version 1 and audits the internal actor", async () => {
  const captured: { obligation?: Record<string, unknown>; report?: Record<string, unknown>; audit?: Record<string, unknown> } = {};
  const transaction = {
    grantAward: { findUnique: async () => ({ id: "award-1", currency: "ZAR" }) },
    user: { findUnique: async () => ({ id: "internal-user-1", firstName: "Admin", lastName: "User" }) },
    grantTranche: { findFirst: async () => null },
    grantReportingObligation: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.obligation = data; return { id: "obligation-1", ...data }; } },
    grantReport: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.report = data; return { id: "report-1", ...data }; } },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.audit = data; return { id: "audit-1" }; } },
  };
  const input = createGrantReportingObligationSchema.parse({ grantAwardId: "award-1", type: "FINAL", basis: "PERIOD", title: "Final report", reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-12-31", dueAt: "2027-01-31" });
  await createGrantReportingObligation(input, "internal-user-1", runner(transaction));
  assert.equal(captured.obligation?.createdByUserId, "internal-user-1");
  assert.equal(captured.report?.status, "DRAFT");
  assert.equal(captured.report?.currentVersionNumber, 1);
  assert.equal(captured.audit?.actorUserId, "internal-user-1");
});

function reportSectionTransaction(versionStatus = "DRAFT", reportStatus = "DRAFT", reportType = "FINAL") {
  const captured: { sustainabilityRows?: unknown; certifications?: Array<Record<string, unknown>>; audit?: Record<string, unknown>; deleted?: boolean; versionUpdates: Array<Record<string, unknown>>; financialCreates: Array<Record<string, unknown>> } = { versionUpdates: [], financialCreates: [] };
  const report = { id: "report-1", status: reportStatus, currentVersionNumber: 1, award: { id: "award-1", awardNumber: "AW-1", title: "Award", awardedAmount: 1000, currency: "ZAR", centre: { id: "centre-1", centreName: "Centre", npoNumber: null, physicalAddress: null, suburb: null, area: null, province: null, postalCode: null, contactPerson: null, phone: null, email: null }, fundingProject: { id: "project-1", title: "Project", objective: null, expectedOutcomes: [], requiredItems: [] }, organisations: [] }, obligation: { tranche: null } };
  const version = { id: "version-1", versionNumber: 1, status: versionStatus, reportType, centreSnapshot: null, projectSnapshot: null, awardSnapshot: null, fundingOrganisationSnapshot: null, trancheSnapshot: null, totalIncome: new Prisma.Decimal("1000.00"), totalExpenditure: new Prisma.Decimal("200.00") };
  const transaction = {
    grantReport: { findUnique: async () => report },
    grantReportVersion: { findUnique: async () => version, update: async ({ data }: { data: Record<string, unknown> }) => { captured.versionUpdates.push(data); return {}; } },
    grantReportFinancialLine: { findMany: async () => [], deleteMany: async () => ({}), create: async ({ data }: { data: Record<string, unknown> }) => { captured.financialCreates.push(data); return {}; }, update: async () => ({}) },
    grantReportSustainabilityItem: { deleteMany: async () => { captured.deleted = true; }, createMany: async ({ data }: { data: unknown }) => { captured.sustainabilityRows = data; } },
    grantReportCertification: { deleteMany: async () => { captured.deleted = true; }, createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { captured.certifications = data; } },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.audit = data; } },
  };
  return { transaction, captured };
}

test("submitted report versions are immutable", async () => {
  const { transaction, captured } = reportSectionTransaction("SUBMITTED", "SUBMITTED");
  const input = saveGrantReportSectionSchema.parse({ section: "sustainability", data: { challenges: "Challenge", organisationalChanges: null, communityChanges: null, rows: [] } });
  await assert.rejects(() => saveGrantReportSection("report-1", input, "internal-user-1", runner(transaction), async () => null), (error: unknown) => error instanceof GrantReportingServiceError && error.status === 409);
  assert.equal(captured.deleted, undefined);
});

test("submitted quarterly expenditure versions are immutable", async () => {
  const { transaction, captured } = reportSectionTransaction("SUBMITTED", "SUBMITTED", "QUARTERLY_EXPENDITURE");
  const input = saveGrantReportSectionSchema.parse({ section: "bank_reconciliation", data: { openingBankBalance: "100.00", closingBankBalance: "80.00" } });
  await assert.rejects(() => saveGrantReportSection("report-1", input, "internal-user-1", runner(transaction), async () => null), (error: unknown) => error instanceof GrantReportingServiceError && error.status === 409);
  assert.equal(captured.versionUpdates.length, 0);
});

test("sustainability rows persist transactionally and audit the internal actor", async () => {
  const { transaction, captured } = reportSectionTransaction();
  const input = saveGrantReportSectionSchema.parse({ section: "sustainability", data: { challenges: "Challenge", organisationalChanges: "New staff", communityChanges: "Improved access", rows: [{ plan: "Diversify funding", progressToDate: "Two applications submitted" }] } });
  await saveGrantReportSection("report-1", input, "internal-user-1", runner(transaction), async () => ({ ok: true } as never));
  assert.deepEqual(captured.sustainabilityRows, [{ grantReportVersionId: "version-1", plan: "Diversify funding", progressToDate: "Two applications submitted", displayOrder: 0 }]);
  assert.equal(captured.audit?.actorUserId, "internal-user-1");
  assert.equal(captured.audit?.action, "grant.report.section.saved");
});

test("digital certification stores the authenticated internal confirmer and timestamp", async () => {
  const { transaction, captured } = reportSectionTransaction();
  const input = saveGrantReportSectionSchema.parse({ section: "certification", data: { rows: [{ party: "COMPILER", nameSnapshot: "External Compiler", designationSnapshot: "Consultant", certificationDate: "2026-08-29", digitallyConfirmed: true }, { party: "APPROVER", nameSnapshot: "Board Chair", designationSnapshot: "Chairperson", certificationDate: "2026-08-29", digitallyConfirmed: false }] } });
  await saveGrantReportSection("report-1", input, "internal-user-1", runner(transaction), async () => ({ ok: true } as never));
  assert.equal(captured.certifications?.[0].confirmedByUserId, "internal-user-1");
  assert.ok(captured.certifications?.[0].confirmedAt instanceof Date);
  assert.equal(captured.certifications?.[1].confirmedByUserId, null);
  assert.equal(captured.certifications?.[1].confirmedAt, null);
});

test("an indicator with linked evidence cannot be removed from a Draft", async () => {
  const { transaction } = reportSectionTransaction();
  Object.assign(transaction, { grantReportIndicator: { findMany: async () => [{ id: "indicator-1", _count: { documents: 1 } }], deleteMany: async () => { throw new Error("must not delete"); } } });
  const input = saveGrantReportSectionSchema.parse({ section: "objectives", data: { rows: [] } });
  await assert.rejects(() => saveGrantReportSection("report-1", input, "internal-user-1", runner(transaction), async () => null), (error: unknown) => error instanceof GrantReportingServiceError && error.status === 409);
});

test("quarterly income and expenditure persist calculated totals transactionally", async () => {
  const income = reportSectionTransaction("DRAFT", "DRAFT", "QUARTERLY_EXPENDITURE");
  const incomeInput = saveGrantReportSectionSchema.parse({ section: "quarterly_income", data: { rows: [{ lineType: "FUNDING_RECEIVED", categoryName: "Department subsidy", amount: "900.10" }, { lineType: "OTHER_INCOME", categoryName: "Other Income", amount: "99.90" }], totalIncome: "1000.00" } });
  await saveGrantReportSection("report-1", incomeInput, "internal-user-1", runner(income.transaction), async () => ({ ok: true } as never));
  assert.equal(String(income.captured.versionUpdates[0].totalIncome), "1000");
  assert.equal(String(income.captured.versionUpdates[0].surplusDeficit), "800");
  assert.equal(income.captured.audit?.actorUserId, "internal-user-1");

  const expenditure = reportSectionTransaction("DRAFT", "DRAFT", "QUARTERLY_EXPENDITURE");
  const expenditureInput = saveGrantReportSectionSchema.parse({ section: "quarterly_expenditure", data: { rows: [{ categoryName: "Nutrition", costingFrameworkPercentage: "25.00", quarterlyBudget: "500.00", fundingSourceActual: "200.10", otherSourceActual: "49.90", quarterlyActual: "250.00" }], totalAllocatedBudget: "500.00", totalFundingSourceExpenditure: "200.10", totalOtherSourceExpenditure: "49.90", totalExpenditure: "250.00", totalIncome: "1000.00", surplusDeficit: "750.00" } });
  await saveGrantReportSection("report-1", expenditureInput, "internal-user-1", runner(expenditure.transaction), async () => ({ ok: true } as never));
  assert.equal(String(expenditure.captured.financialCreates[0].quarterlyActual), "250");
  assert.equal(String(expenditure.captured.versionUpdates[0].totalExpenditure), "250");
  assert.equal(String(expenditure.captured.versionUpdates[0].surplusDeficit), "750");
});

test("quarterly bank balances persist and report-type section boundaries are enforced", async () => {
  const quarterly = reportSectionTransaction("DRAFT", "DRAFT", "QUARTERLY_EXPENDITURE");
  const bankInput = saveGrantReportSectionSchema.parse({ section: "bank_reconciliation", data: { openingBankBalance: "100.10", closingBankBalance: "200.20" } });
  await saveGrantReportSection("report-1", bankInput, "internal-user-1", runner(quarterly.transaction), async () => ({ ok: true } as never));
  assert.deepEqual(quarterly.captured.versionUpdates[0], { openingBankBalance: "100.10", closingBankBalance: "200.20" });

  const nlc = reportSectionTransaction();
  await assert.rejects(() => saveGrantReportSection("report-1", bankInput, "internal-user-1", runner(nlc.transaction), async () => null), (error: unknown) => error instanceof GrantReportingServiceError && error.status === 422);
});
