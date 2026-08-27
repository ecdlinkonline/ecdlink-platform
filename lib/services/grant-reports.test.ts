import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { createGrantAward, createGrantReportingObligation, GrantReportingServiceError, type GrantReportingTransactionRunner } from "./grant-reports";
import { createGrantAwardSchema, createGrantReportingObligationSchema } from "@/lib/validators/grant-reports";

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
  const input = createGrantReportingObligationSchema.parse({ grantAwardId: "award-1", type: "FINAL", basis: "FINAL", title: "Final report", reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-12-31", dueAt: "2027-01-31" });
  await createGrantReportingObligation(input, "internal-user-1", runner(transaction));
  assert.equal(captured.obligation?.createdByUserId, "internal-user-1");
  assert.equal(captured.report?.status, "DRAFT");
  assert.equal(captured.report?.currentVersionNumber, 1);
  assert.equal(captured.audit?.actorUserId, "internal-user-1");
});
