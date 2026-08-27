import assert from "node:assert/strict";
import test from "node:test";
import { buildGrantAwardSubmission, grantAwardLeadOrganisation, grantAwardSourceFieldState, updateGrantAwardSource, validateGrantAwardSource, type GrantAwardFormSources, type GrantAwardFormValues } from "./award-form";

const sources: GrantAwardFormSources = {
  applications: [
    { id: "application-1", applicationNumber: "APP-001", centreId: "centre-1", centreName: "Bright Centre", projectId: "project-1", projectTitle: "Nutrition", organisationId: "funder-1", organisationName: "Fund One", approvedAmount: 125000 },
    { id: "application-2", applicationNumber: "APP-002", centreId: "centre-2", centreName: "Hope Centre", projectId: "project-2", projectTitle: "Equipment", organisationId: "funder-2", organisationName: "Fund Two", approvedAmount: null },
  ],
  commitments: [
    { id: "commitment-1", referenceNumber: "COM-001", centreId: "centre-3", centreName: "Care Centre", fundingProjectId: "project-3", projectTitle: "Learning", organisationId: "donor-1", organisationName: "Donor One", committedAmount: 50000 },
    { id: "commitment-2", referenceNumber: "COM-002", centreId: "centre-3", centreName: "Care Centre", fundingProjectId: null, projectTitle: null, organisationId: "donor-1", organisationName: "Donor One", committedAmount: null },
  ],
};

function values(overrides: Partial<GrantAwardFormValues> = {}): GrantAwardFormValues {
  return { sourceType: "MANUAL", fundingApplicationId: "", sponsorshipCommitmentId: "", centreId: "", fundingProjectId: "", awardNumber: "", title: "", description: "", awardedAmount: "", currency: "ZAR", organisationType: "FUNDING_ORGANISATION", fundingOrganisationId: "", donorOrganisationId: "", startDate: "", endDate: "", agreementDate: "", signedByBothParties: false, canReview: true, canApprove: false, ...overrides };
}

test("Funding Application selection populates and locks its centre, project, funder and approved amount", () => {
  const populated = updateGrantAwardSource(values({ sourceType: "FUNDING_APPLICATION", fundingApplicationId: "application-1" }), "fundingApplicationId", sources);
  assert.deepEqual({ centreId: populated.centreId, projectId: populated.fundingProjectId, funderId: populated.fundingOrganisationId, amount: populated.awardedAmount }, { centreId: "centre-1", projectId: "project-1", funderId: "funder-1", amount: 125000 });
  const attemptedChange = updateGrantAwardSource({ ...populated, centreId: "unrelated-centre" }, "centreId", sources);
  assert.equal(attemptedChange.centreId, "centre-1");
  assert.equal(grantAwardSourceFieldState("FUNDING_APPLICATION").relationshipFieldsDisabled, true);
  assert.equal(grantAwardLeadOrganisation(populated, sources), "Fund One");
});

test("a missing approved amount remains blank and editable", () => {
  const populated = updateGrantAwardSource(values({ sourceType: "FUNDING_APPLICATION", fundingApplicationId: "application-2" }), "fundingApplicationId", sources);
  assert.equal(populated.awardedAmount, "");
  assert.equal(updateGrantAwardSource({ ...populated, awardedAmount: 25000 }, "awardedAmount", sources).awardedAmount, 25000);
});

test("Sponsorship Commitment selection populates centre, project, donor and amount", () => {
  const populated = updateGrantAwardSource(values({ sourceType: "SPONSORSHIP_COMMITMENT", sponsorshipCommitmentId: "commitment-1" }), "sponsorshipCommitmentId", sources);
  assert.deepEqual({ centreId: populated.centreId, projectId: populated.fundingProjectId, donorId: populated.donorOrganisationId, amount: populated.awardedAmount }, { centreId: "centre-3", projectId: "project-3", donorId: "donor-1", amount: 50000 });
  assert.equal(grantAwardLeadOrganisation(populated, sources), "Donor One");
});

test("a commitment without FundingProject is blocked with a clear validation error", () => {
  const populated = updateGrantAwardSource(values({ sourceType: "SPONSORSHIP_COMMITMENT", sponsorshipCommitmentId: "commitment-2" }), "sponsorshipCommitmentId", sources);
  assert.equal(populated.fundingProjectId, "");
  assert.match(validateGrantAwardSource(populated, sources).sponsorshipCommitmentId ?? "", /linked to a FundingProject/);
});

test("Manual hides source selectors and a source-type change clears stale derived values", () => {
  assert.deepEqual(grantAwardSourceFieldState("MANUAL"), { showFundingApplication: false, showSponsorshipCommitment: false, relationshipFieldsDisabled: false, showPartnerType: true, showOrganisationRole: false });
  const reset = updateGrantAwardSource(values({ sourceType: "MANUAL", fundingApplicationId: "application-1", centreId: "centre-1", fundingProjectId: "project-1", fundingOrganisationId: "funder-1", awardedAmount: 125000 }), "sourceType", sources);
  assert.deepEqual({ application: reset.fundingApplicationId, commitment: reset.sponsorshipCommitmentId, centre: reset.centreId, project: reset.fundingProjectId, funder: reset.fundingOrganisationId, amount: reset.awardedAmount }, { application: "", commitment: "", centre: "", project: "", funder: "", amount: "" });
});

test("submission keeps derived organisation IDs but never exposes an organisation role choice", () => {
  const populated = updateGrantAwardSource(values({ sourceType: "FUNDING_APPLICATION", fundingApplicationId: "application-1" }), "fundingApplicationId", sources);
  const payload = buildGrantAwardSubmission(populated, "file-1");
  assert.equal(payload.organisationType, "FUNDING_ORGANISATION");
  assert.equal(payload.fundingOrganisationId, "funder-1");
  assert.equal(payload.signedAgreementFileAssetId, "file-1");
  assert.equal("organisationRole" in payload, false);
});

test("manual partner type remains selectable and clears an incompatible organisation", () => {
  const changed = updateGrantAwardSource(values({ organisationType: "DONOR_ORGANISATION", fundingOrganisationId: "stale-funder" }), "organisationType", sources);
  assert.equal(changed.fundingOrganisationId, "");
  assert.equal(changed.organisationType, "DONOR_ORGANISATION");
});
