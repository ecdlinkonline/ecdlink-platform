import assert from "node:assert/strict";
import test from "node:test";
import { executeGrantAwardCreation } from "./create-award-flow";
import type { GrantAwardFormValues } from "./award-form";

const values: GrantAwardFormValues = {
  sourceType: "MANUAL", fundingApplicationId: "", sponsorshipCommitmentId: "", centreId: "centre-1",
  fundingProjectId: "project-1", awardNumber: "AW-1", title: "Award", description: "", awardedAmount: 100,
  currency: "ZAR", startDate: "2026-08-01", endDate: "", organisationType: "FUNDING_ORGANISATION",
  fundingOrganisationId: "org-1", donorOrganisationId: "", agreementDate: "", signedByBothParties: false,
  canReview: true, canApprove: false,
};
const agreement = new File(["%PDF-1"], "agreement.pdf", { type: "application/pdf" });

test("one award action stages once and creates once without automatic retries", async () => {
  const calls: string[] = [];
  const phases: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input); calls.push(url);
    return url.endsWith("/stage")
      ? Response.json({ data: { id: "file-1" } }, { status: 201 })
      : Response.json({ data: { id: "award-1" } }, { status: 201 });
  };
  const result = await executeGrantAwardCreation({ values, agreementFile: agreement, fetcher, onPhase: (phase) => phases.push(phase) });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["/api/grant-awards/agreements/stage", "/api/grant-awards"]);
  assert.deepEqual(phases, ["uploading", "creating"]);
});

test("a failed or rate-limited stage request never creates an award or retries", async () => {
  let calls = 0;
  const result = await executeGrantAwardCreation({ values, agreementFile: agreement, fetcher: async () => {
    calls += 1;
    return Response.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": "30" } });
  } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Too many requests. Please try again later.");
  assert.equal(calls, 1);
});

test("an award API failure relies on its server-owned staged cleanup exactly once", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input); calls.push(url);
    return url.endsWith("/stage")
      ? Response.json({ data: { id: "file-1" } }, { status: 201 })
      : Response.json({ error: "The award could not be created." }, { status: 500 });
  };
  const result = await executeGrantAwardCreation({ values, agreementFile: agreement, fetcher });
  assert.equal(result.ok, false);
  assert.deepEqual(calls, ["/api/grant-awards/agreements/stage", "/api/grant-awards"]);
});
