import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { createGrantReportingObligation, createNextGrantReportingPeriod, GrantReportingServiceError, type GrantReportingTransactionRunner } from "./grant-reports";
import { createGrantReportingObligationSchema } from "@/lib/validators/grant-reports";

function runner(transaction: object): GrantReportingTransactionRunner {
  return async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) => operation(transaction as Prisma.TransactionClient);
}

function lifecycleTransaction(overrides: { actorRole?: string; actorStatus?: string; awardStatus?: string; collision?: object | null; sourceAwardId?: string; sourceType?: string; sourceStatus?: string; reportStatus?: string } = {}) {
  const captured: { obligation?: Record<string, unknown>; report?: Record<string, unknown>; audit?: Record<string, unknown> } = {};
  const source = { id: "source-1", grantAwardId: overrides.sourceAwardId ?? "award-1", type: overrides.sourceType ?? "QUARTERLY_CASH_FLOW", basis: "QUARTER", title: "Q1", reportingPeriodStart: new Date("2026-04-01"), reportingPeriodEnd: new Date("2026-06-30"), financialYear: "2026", quarter: 1, requiresFunderApproval: true, requiresSuperAdminApproval: false, status: overrides.sourceStatus ?? "SUBMITTED", report: { status: overrides.reportStatus ?? "SUBMITTED" } };
  const transaction = {
    grantAward: { findUnique: async () => ({ id: "award-1", currency: "ZAR", status: overrides.awardStatus ?? "ACTIVE" }) },
    user: { findUnique: async () => ({ id: "user-1", firstName: "Admin", lastName: "User", role: overrides.actorRole ?? "SUPER_ADMIN", status: overrides.actorStatus ?? "ACTIVE" }) },
    grantTranche: { findFirst: async () => null },
    grantReportingObligation: {
      findUnique: async () => source,
      findFirst: async () => overrides.collision ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => { captured.obligation = data; return { id: "obligation-2", ...data }; },
    },
    grantReport: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.report = data; return { id: "report-2", ...data }; } },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.audit = data; return { id: "audit-1" }; } },
  };
  return { transaction, captured };
}

const periodInput = createGrantReportingObligationSchema.parse({ grantAwardId: "award-1", type: "QUARTERLY_CASH_FLOW", basis: "QUARTER", title: "Q2", financialYear: "2026", quarter: 2, reportingPeriodStart: "2026-07-01", reportingPeriodEnd: "2026-09-30", dueAt: "2026-10-15" });

test("non-overlapping obligations create one OPEN obligation, one DRAFT report and only version 1", async () => {
  const { transaction, captured } = lifecycleTransaction();
  await createGrantReportingObligation(periodInput, "user-1", runner(transaction));
  assert.equal(captured.obligation?.status, "OPEN");
  assert.equal(captured.report?.status, "DRAFT");
  assert.equal(captured.report?.currentVersionNumber, 1);
  const version = (captured.report?.versions as { create: Record<string, unknown> }).create;
  assert.equal(version.status, "DRAFT");
  assert.equal(version.versionNumber, 1);
  for (const forbidden of ["financialLines", "bankImportBatches", "documents", "certifications", "readiness", "reconciliation", "provenance"]) assert.equal(forbidden in version, false);
});

test("same-type exact and overlapping periods are conflicts while other types remain legitimate", async () => {
  const exact = lifecycleTransaction({ collision: { id: "existing-obligation", reportingPeriodStart: periodInput.reportingPeriodStart, reportingPeriodEnd: periodInput.reportingPeriodEnd, report: { id: "existing-report" } } });
  await assert.rejects(() => createGrantReportingObligation(periodInput, "user-1", runner(exact.transaction)), (error: unknown) => error instanceof GrantReportingServiceError && error.status === 409 && (error.details as { existingReportId: string }).existingReportId === "existing-report");
  const overlap = lifecycleTransaction({ collision: { id: "overlap", reportingPeriodStart: new Date("2026-08-01"), reportingPeriodEnd: new Date("2026-10-31"), report: null } });
  await assert.rejects(() => createGrantReportingObligation(periodInput, "user-1", runner(overlap.transaction)), /overlaps/);
  const otherType = lifecycleTransaction();
  await createGrantReportingObligation({ ...periodInput, type: "QUARTERLY_EXPENDITURE" }, "user-1", runner(otherType.transaction));
  assert.equal(otherType.captured.obligation?.type, "QUARTERLY_EXPENDITURE");
});

test("creation requires an active database SUPER_ADMIN and active award", async () => {
  for (const overrides of [{ actorRole: "ECDLINK_STAFF" }, { actorStatus: "SUSPENDED" }, { awardStatus: "SUSPENDED" }]) {
    const { transaction } = lifecycleTransaction(overrides);
    await assert.rejects(() => createGrantReportingObligation(periodInput, "user-1", runner(transaction)), (error: unknown) => error instanceof GrantReportingServiceError && [403, 409].includes(error.status));
  }
});

test("next period is server-derived, creates no copied child data and audits source context", async () => {
  const { transaction, captured } = lifecycleTransaction();
  const result = await createNextGrantReportingPeriod("source-1", "award-1", new Date("2026-10-15"), "user-1", runner(transaction));
  assert.equal(result.report.id, "report-2");
  assert.deepEqual(captured.obligation?.reportingPeriodStart, new Date("2026-07-01"));
  assert.deepEqual(captured.obligation?.reportingPeriodEnd, new Date("2026-09-30"));
  assert.equal(captured.obligation?.quarter, 2);
  assert.equal(captured.audit?.action, "grant.reporting_obligation.next_period.create");
  const metadata = captured.audit?.metadata as Record<string, unknown>;
  assert.equal(metadata.sourceObligationId, "source-1");
  assert.equal(metadata.newObligationId, "obligation-2");
});

test("next period rejects cross-award, unsubmitted and unsupported sources", async () => {
  await assert.rejects(() => createNextGrantReportingPeriod("source-1", "award-2", new Date(), "user-1", runner(lifecycleTransaction().transaction)), /does not belong/);
  await assert.rejects(() => createNextGrantReportingPeriod("source-1", "award-1", new Date(), "user-1", runner(lifecycleTransaction({ sourceStatus: "OPEN", reportStatus: "DRAFT" }).transaction)), /must be submitted/);
  await assert.rejects(() => createNextGrantReportingPeriod("source-1", "award-1", new Date(), "user-1", runner(lifecycleTransaction({ sourceType: "CUSTOM" }).transaction)), /not available/);
});

test("a serializable concurrency conflict returns a controlled duplicate response", async () => {
  const conflictRunner: GrantReportingTransactionRunner = async () => { throw new Prisma.PrismaClientKnownRequestError("serialization failure", { code: "P2034", clientVersion: "6.14.0" }); };
  await assert.rejects(() => createNextGrantReportingPeriod("source-1", "award-1", new Date(), "user-1", conflictRunner), (error: unknown) => error instanceof GrantReportingServiceError && error.status === 409 && /another request/.test(error.message));
});
