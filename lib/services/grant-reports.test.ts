import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { createGrantAward, createGrantReportingObligation, GrantReportingServiceError, saveGrantReportSection, submitGrantReport, type GrantReportingTransactionRunner } from "./grant-reports";
import { createGrantAwardSchema, createGrantReportingObligationSchema, saveGrantReportSectionSchema } from "@/lib/validators/grant-reports";
import type { SubmissionReadinessCheck } from "@/lib/grant-reports/submission-readiness";

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
    grantAward: { findUnique: async () => ({ id: "award-1", currency: "ZAR", status: "ACTIVE" }) },
    user: { findUnique: async () => ({ id: "internal-user-1", firstName: "Admin", lastName: "User", role: "SUPER_ADMIN", status: "ACTIVE" }) },
    grantTranche: { findFirst: async () => null },
    grantReportingObligation: { findFirst: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { captured.obligation = data; return { id: "obligation-1", ...data }; } },
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
  const captured: { sustainabilityRows?: unknown; certifications?: Array<Record<string, unknown>>; audit?: Record<string, unknown>; audits: Record<string, unknown>[]; deleted?: boolean; obligationUpdate?: Record<string, unknown>; bankBatchWhere?: Record<string, unknown>; bankBatchUpdate?: Record<string, unknown>; versionUpdates: Array<Record<string, unknown>>; financialCreates: Array<Record<string, unknown>> } = { audits: [], versionUpdates: [], financialCreates: [] };
  const report = { id: "report-1", status: reportStatus, currentVersionNumber: 1, award: { id: "award-1", awardNumber: "AW-1", title: "Award", awardedAmount: 1000, currency: "ZAR", centre: { id: "centre-1", centreName: "Centre", npoNumber: null, physicalAddress: null, suburb: null, area: null, province: null, postalCode: null, contactPerson: null, phone: null, email: null }, fundingProject: { id: "project-1", title: "Project", objective: null, expectedOutcomes: [], requiredItems: [] }, organisations: [] }, obligation: { id: "obligation-1", financialYear: "2026", quarter: 1, tranche: null } };
  const version = { id: "version-1", versionNumber: 1, status: versionStatus, reportType, centreSnapshot: null, projectSnapshot: null, awardSnapshot: null, fundingOrganisationSnapshot: null, trancheSnapshot: null, totalIncome: new Prisma.Decimal("1000.00"), totalExpenditure: new Prisma.Decimal("200.00") };
  const transaction = {
    grantReport: { findUnique: async () => report },
    grantReportVersion: { findUnique: async () => version, findMany: async () => [], update: async ({ data }: { data: Record<string, unknown> }) => { captured.versionUpdates.push(data); return {}; } },
    grantReportFinancialLine: { findMany: async () => [], deleteMany: async () => ({}), create: async ({ data }: { data: Record<string, unknown> }) => { captured.financialCreates.push(data); return {}; }, update: async () => ({}) },
    grantReportSustainabilityItem: { deleteMany: async () => { captured.deleted = true; }, createMany: async ({ data }: { data: unknown }) => { captured.sustainabilityRows = data; } },
    grantReportCertification: { findMany: async () => [], deleteMany: async () => { captured.deleted = true; }, createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { captured.certifications = data; } },
    grantReportingObligation: { update: async ({ data }: { data: Record<string, unknown> }) => { captured.obligationUpdate = data; return {}; } },
    grantBankImportBatch: { updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => { captured.bankBatchWhere = where; captured.bankBatchUpdate = data; return { count: 1 }; } },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.audit = data; captured.audits.push(data); } },
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

test("submitted and approved quarterly cash flow versions are immutable", async () => {
  for (const status of ["SUBMITTED", "APPROVED"]) {
    const { transaction, captured } = reportSectionTransaction(status, status, "QUARTERLY_CASH_FLOW");
    const input = saveGrantReportSectionSchema.parse({ section: "cash_received", data: { rows: [{ lineType: "FUNDING_RECEIVED", categoryName: "Subsidy", amount: "100.00" }], totalCashAvailable: "100.00" } });
    await assert.rejects(() => saveGrantReportSection("report-1", input, "internal-user-1", runner(transaction), async () => null), (error: unknown) => error instanceof GrantReportingServiceError && error.status === 409);
    assert.equal(captured.versionUpdates.length, 0);
  }
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
  assert.deepEqual(captured.audits.map((audit) => audit.action), ["grant.report.compiler_certified", "grant.report.section.saved"]);
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

test("cash received and operating expenses persist calculated cash-flow totals with the internal actor", async () => {
  const cash = reportSectionTransaction("DRAFT", "DRAFT", "QUARTERLY_CASH_FLOW");
  const cashInput = saveGrantReportSectionSchema.parse({ section: "cash_received", data: { rows: [{ lineType: "FUNDING_RECEIVED", categoryName: "Subsidy", amount: "900.10" }, { lineType: "OTHER_INCOME", categoryName: "Other Income", amount: "99.90" }], totalCashAvailable: "1000.00" } });
  await saveGrantReportSection("report-1", cashInput, "internal-user-1", runner(cash.transaction), async () => ({ ok: true } as never));
  assert.equal(String(cash.captured.versionUpdates[0].totalIncome), "1000");
  assert.equal(cash.captured.audit?.actorUserId, "internal-user-1");

  const expenses = reportSectionTransaction("DRAFT", "DRAFT", "QUARTERLY_CASH_FLOW");
  const expenseInput = saveGrantReportSectionSchema.parse({ section: "operating_expenses", data: { rows: [{ categoryName: "Principal", quarterlyBudget: "500.00", estimatedExpenditure: "450.10", variance: "49.90", reasonForVariance: "Vacancy" }], totalCashAvailable: "1000.00", totalQuarterlyBudget: "500.00", totalExpenditure: "450.10", totalVariance: "49.90", remainingCash: "549.90" } });
  await saveGrantReportSection("report-1", expenseInput, "internal-user-1", runner(expenses.transaction), async () => ({ ok: true } as never));
  const createdExpense = expenses.captured.financialCreates.find((row) => row.lineType === "EXPENDITURE");
  assert.equal(String(createdExpense?.variance), "49.9");
  assert.equal(createdExpense?.reasonForVariance, "Vacancy");
  assert.equal(String(expenses.captured.versionUpdates.at(-1)?.totalExpenditure), "450.1");
});

test("cash flow source income is copied once and never overwrites saved cash received rows", async () => {
  const initialized = reportSectionTransaction("DRAFT", "DRAFT", "QUARTERLY_CASH_FLOW");
  Object.assign(initialized.transaction.grantReportVersion, { findMany: async ({ where }: { where: { status: string } }) => where.status === "APPROVED" ? [{ id: "source-version", status: "APPROVED", versionNumber: 2, report: { currentVersionNumber: 2 }, financialLines: [{ lineType: "FUNDING_RECEIVED", categoryName: "Department subsidy", quarterlyActual: new Prisma.Decimal("800.00") }, { lineType: "OTHER_INCOME", categoryName: "Fundraising", quarterlyActual: new Prisma.Decimal("25.00") }] }] : [] });
  const generalInput = saveGrantReportSectionSchema.parse({ section: "cash_flow_general", data: { financialYear: "2026", quarter: 1, reportingPeriodStart: "2026-04-01", reportingPeriodEnd: "2026-06-30" } });
  await saveGrantReportSection("report-1", generalInput, "internal-user-1", runner(initialized.transaction), async () => ({ ok: true } as never));
  const generalVersionUpdate = initialized.captured.versionUpdates.find((update) => update.reportingPeriodStart instanceof Date);
  assert.equal((generalVersionUpdate?.reportingPeriodStart as Date).toISOString().slice(0, 10), "2026-04-01");
  assert.equal((generalVersionUpdate?.reportingPeriodEnd as Date).toISOString().slice(0, 10), "2026-06-30");
  assert.equal((initialized.captured.obligationUpdate?.reportingPeriodStart as Date).toISOString().slice(0, 10), "2026-04-01");
  assert.equal((initialized.captured.obligationUpdate?.reportingPeriodEnd as Date).toISOString().slice(0, 10), "2026-06-30");
  assert.equal((initialized.captured.bankBatchUpdate?.reportingPeriodStart as Date).toISOString().slice(0, 10), "2026-04-01");
  assert.equal((initialized.captured.bankBatchUpdate?.reportingPeriodEnd as Date).toISOString().slice(0, 10), "2026-06-30");
  assert.deepEqual(initialized.captured.bankBatchWhere, {
    originatingGrantReportId: "report-1",
    financialYear: "2026",
    quarter: 1,
    status: { in: ["UPLOADING", "NEEDS_REVIEW", "READY_FOR_CONFIRMATION", "FAILED"] },
  });
  assert.deepEqual(initialized.captured.financialCreates.slice(0, 2).map((row) => ({ lineType: row.lineType, categoryName: row.categoryName, amount: String(row.quarterlyActual) })), [{ lineType: "FUNDING_RECEIVED", categoryName: "Subsidy", amount: "800.00" }, { lineType: "OTHER_INCOME", categoryName: "Fundraising", amount: "25.00" }]);

  const copiedThenExpense = reportSectionTransaction("DRAFT", "DRAFT", "QUARTERLY_CASH_FLOW");
  Object.assign(copiedThenExpense.transaction.grantReportVersion, { findMany: async ({ where }: { where: { status: string } }) => where.status === "APPROVED" ? [{ id: "source-version", status: "APPROVED", versionNumber: 2, report: { currentVersionNumber: 2 }, financialLines: [{ lineType: "FUNDING_RECEIVED", categoryName: "Department subsidy", quarterlyActual: new Prisma.Decimal("800.00") }, { lineType: "OTHER_INCOME", categoryName: "Fundraising", quarterlyActual: new Prisma.Decimal("25.00") }] }] : [] });
  const expenseInput = saveGrantReportSectionSchema.parse({ section: "operating_expenses", data: { rows: [{ categoryName: "Principal", quarterlyBudget: "500.00", estimatedExpenditure: "450.10", variance: "49.90", reasonForVariance: "Vacancy" }], totalCashAvailable: "825.00", totalQuarterlyBudget: "500.00", totalExpenditure: "450.10", totalVariance: "49.90", remainingCash: "374.90" } });
  await saveGrantReportSection("report-1", expenseInput, "internal-user-1", runner(copiedThenExpense.transaction), async () => ({ ok: true } as never));
  assert.equal(String(copiedThenExpense.captured.versionUpdates.at(-1)?.surplusDeficit), "374.9");

  const saved = reportSectionTransaction("DRAFT", "DRAFT", "QUARTERLY_CASH_FLOW");
  let sourceQueries = 0;
  Object.assign(saved.transaction.grantReportFinancialLine, { findMany: async () => [{ id: "owned-cash-row" }] });
  Object.assign(saved.transaction.grantReportVersion, { findMany: async () => { sourceQueries += 1; return []; } });
  await saveGrantReportSection("report-1", generalInput, "internal-user-1", runner(saved.transaction), async () => ({ ok: true } as never));
  assert.equal(sourceQueries, 0);
  assert.equal(saved.captured.financialCreates.length, 0);
});

function submissionFixture(options: { reportStatus?: string; versionStatus?: string; submittedAt?: Date | null; readiness?: "READY" | "NEEDS_REVIEW" | "BLOCKED"; checks?: SubmissionReadinessCheck[]; actor?: boolean } = {}) {
  const captured = { reportUpdates: 0, versionUpdates: 0, obligationUpdates: 0, audits: [] as Record<string, unknown>[] };
  const transaction = {
    user: { findFirst: async () => options.actor === false ? null : { id: "internal-admin" } },
    grantReport: {
      findUnique: async () => ({ id: "report-1", status: options.reportStatus ?? "DRAFT", currentVersionNumber: 1, obligationId: "obligation-1" }),
      updateMany: async () => { captured.reportUpdates += 1; return { count: 1 }; },
    },
    grantReportVersion: {
      findUnique: async () => ({ id: "version-1", versionNumber: 1, status: options.versionStatus ?? "DRAFT", reportType: "QUARTERLY_CASH_FLOW", submittedAt: options.submittedAt ?? null }),
      updateMany: async () => { captured.versionUpdates += 1; return { count: 1 }; },
    },
    grantReportingObligation: { update: async () => { captured.obligationUpdates += 1; return {}; } },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.audits.push(data); return {}; } },
  };
  const editor = { quarterlyCashFlow: { submissionReadiness: { state: options.readiness ?? "READY", checks: options.checks ?? [], attentionCount: 0 } } } as never;
  return { transaction, captured, editor };
}

test("READY report submits atomically with internal actor and one authoritative audit", async () => {
  const fixture = submissionFixture();
  const reload = async () => ({ id: "submitted-editor" } as never);
  const result = await submitGrantReport("report-1", { acknowledgeWarnings: false }, "internal-admin", runner(fixture.transaction), reload, async () => fixture.editor);
  assert.equal(result.alreadySubmitted, false);
  assert.equal(fixture.captured.versionUpdates, 1);
  assert.equal(fixture.captured.reportUpdates, 1);
  assert.equal(fixture.captured.obligationUpdates, 1);
  assert.equal(fixture.captured.audits.length, 1);
  assert.equal(fixture.captured.audits[0].action, "grant.report.submitted");
  assert.equal(fixture.captured.audits[0].actorUserId, "internal-admin");
});

test("BLOCKED never submits and NEEDS_REVIEW requires explicit acknowledgement", async () => {
  for (const [readiness, acknowledgeWarnings] of [["BLOCKED", true], ["NEEDS_REVIEW", false]] as const) {
    const fixture = submissionFixture({ readiness });
    await assert.rejects(() => submitGrantReport("report-1", { acknowledgeWarnings }, "internal-admin", runner(fixture.transaction), async () => null, async () => fixture.editor), (error: unknown) => error instanceof GrantReportingServiceError && error.status === 409);
    assert.equal(fixture.captured.versionUpdates, 0);
    assert.equal(fixture.captured.audits.length, 0);
  }
});

test("NEEDS_REVIEW submits only after acknowledgement and repeated submitted requests are idempotent", async () => {
  const warning = submissionFixture({ readiness: "NEEDS_REVIEW" });
  await submitGrantReport("report-1", { acknowledgeWarnings: true }, "internal-admin", runner(warning.transaction), async () => ({ ok: true } as never), async () => warning.editor);
  assert.equal(warning.captured.audits.length, 1);

  const submitted = submissionFixture({ reportStatus: "SUBMITTED", versionStatus: "SUBMITTED", submittedAt: new Date("2026-09-17T10:00:00Z") });
  const result = await submitGrantReport("report-1", { acknowledgeWarnings: true }, "internal-admin", runner(submitted.transaction), async () => ({ ok: true } as never), async () => { throw new Error("readiness must not rerun for an identical retry"); });
  assert.equal(result.alreadySubmitted, true);
  assert.equal(submitted.captured.versionUpdates, 0);
  assert.equal(submitted.captured.audits.length, 0);
});

test("submission audit immutably snapshots actionable warnings without the parent summary", async () => {
  const checks: SubmissionReadinessCheck[] = [
    { id: "reconciliation", group: "Financial Information", title: "Financial reconciliation", detail: "Review notices need attention.", status: "NEEDS_REVIEW" },
    { id: "cash", parentCheckId: "reconciliation", group: "Financial Information", title: "Recorded cash position", detail: "Expenditure exceeds cash.", status: "NEEDS_REVIEW" },
    { id: "april", group: "Bank Evidence", title: "April statement", detail: "Difference -227.80.", status: "NEEDS_REVIEW" },
  ];
  const fixture = submissionFixture({ readiness: "NEEDS_REVIEW", checks });
  await submitGrantReport("report-1", { acknowledgeWarnings: true }, "internal-admin", runner(fixture.transaction), async () => ({ ok: true } as never), async () => fixture.editor);
  assert.equal(fixture.captured.audits.length, 1);
  const metadata = fixture.captured.audits[0].metadata as Record<string, unknown>;
  assert.equal(metadata.readinessState, "NEEDS_REVIEW");
  assert.equal(metadata.warningAcknowledged, true);
  assert.equal(metadata.readinessWarningSnapshotVersion, 1);
  assert.deepEqual(metadata.readinessWarnings, [
    { id: "cash", group: "Financial Information", title: "Recorded cash position", detail: "Expenditure exceeds cash.", status: "NEEDS_REVIEW" },
    { id: "april", group: "Bank Evidence", title: "April statement", detail: "Difference -227.80.", status: "NEEDS_REVIEW" },
  ]);
  assert.deepEqual(checks[0].title, "Financial reconciliation");
});

test("submission requires an active database SUPER_ADMIN and never mutates financial lines", async () => {
  const fixture = submissionFixture({ actor: false });
  await assert.rejects(() => submitGrantReport("report-1", { acknowledgeWarnings: false }, "clerk-metadata-actor", runner(fixture.transaction), async () => null, async () => fixture.editor), (error: unknown) => error instanceof GrantReportingServiceError && error.status === 403);
  assert.equal(fixture.captured.versionUpdates, 0);
  assert.equal(fixture.captured.reportUpdates, 0);
  assert.equal(fixture.captured.audits.length, 0);
});
