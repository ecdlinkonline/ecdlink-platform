import type { WorkflowActionValues } from "@/components/workflows/workflow-action-dialog";

export type GrantAwardFormValues = WorkflowActionValues & {
  sourceType: string;
  fundingApplicationId: string;
  sponsorshipCommitmentId: string;
  centreId: string;
  fundingProjectId: string;
  awardNumber: string;
  title: string;
  description: string;
  awardedAmount: number | string;
  currency: string;
  organisationType: string;
  fundingOrganisationId: string;
  donorOrganisationId: string;
};

export type GrantAwardFormSources = {
  applications: Array<{
    id: string;
    applicationNumber: string;
    centreId: string;
    centreName: string;
    projectId: string;
    projectTitle: string;
    organisationId: string | null;
    organisationName: string | null;
    approvedAmount: number | null;
  }>;
  commitments: Array<{
    id: string;
    referenceNumber: string;
    centreId: string;
    centreName: string;
    fundingProjectId: string | null;
    projectTitle: string | null;
    organisationId: string;
    organisationName: string;
    committedAmount: number | null;
  }>;
};

export function grantAwardSourceFieldState(sourceType: string) {
  return {
    showFundingApplication: sourceType === "FUNDING_APPLICATION",
    showSponsorshipCommitment: sourceType === "SPONSORSHIP_COMMITMENT",
    relationshipFieldsDisabled: sourceType !== "MANUAL",
  };
}

const derivedDefaults = {
  centreId: "",
  fundingProjectId: "",
  fundingOrganisationId: "",
  donorOrganisationId: "",
  awardedAmount: "",
};

export function updateGrantAwardSource(
  values: GrantAwardFormValues,
  changedField: string,
  sources: GrantAwardFormSources,
): GrantAwardFormValues {
  if (changedField === "sourceType") {
    return {
      ...values,
      ...derivedDefaults,
      fundingApplicationId: "",
      sponsorshipCommitmentId: "",
      organisationType: values.sourceType === "SPONSORSHIP_COMMITMENT" ? "DONOR_ORGANISATION" : "FUNDING_ORGANISATION",
    };
  }

  if (values.sourceType === "FUNDING_APPLICATION" && ["fundingApplicationId", "centreId", "fundingProjectId", "organisationType", "fundingOrganisationId", "donorOrganisationId"].includes(changedField)) {
    const source = sources.applications.find((application) => application.id === values.fundingApplicationId);
    if (!source) return { ...values, ...derivedDefaults };
    return {
      ...values,
      sponsorshipCommitmentId: "",
      centreId: source.centreId,
      fundingProjectId: source.projectId,
      organisationType: "FUNDING_ORGANISATION",
      fundingOrganisationId: source.organisationId ?? "",
      donorOrganisationId: "",
      awardedAmount: source.approvedAmount ?? "",
    };
  }

  if (values.sourceType === "SPONSORSHIP_COMMITMENT" && ["sponsorshipCommitmentId", "centreId", "fundingProjectId", "organisationType", "fundingOrganisationId", "donorOrganisationId"].includes(changedField)) {
    const source = sources.commitments.find((commitment) => commitment.id === values.sponsorshipCommitmentId);
    if (!source) return { ...values, ...derivedDefaults };
    return {
      ...values,
      fundingApplicationId: "",
      centreId: source.centreId,
      fundingProjectId: source.fundingProjectId ?? "",
      organisationType: "DONOR_ORGANISATION",
      fundingOrganisationId: "",
      donorOrganisationId: source.organisationId,
      awardedAmount: source.committedAmount ?? "",
    };
  }

  return values;
}

export function validateGrantAwardSource(values: GrantAwardFormValues, sources: GrantAwardFormSources) {
  if (values.sourceType === "FUNDING_APPLICATION") {
    const source = sources.applications.find((application) => application.id === values.fundingApplicationId);
    if (!source) return { fundingApplicationId: "Select an approved Funding Application." };
    if (!source.organisationId) return { fundingApplicationId: "This application has no linked funding organisation and cannot be converted." };
  }
  if (values.sourceType === "SPONSORSHIP_COMMITMENT") {
    const source = sources.commitments.find((commitment) => commitment.id === values.sponsorshipCommitmentId);
    if (!source) return { sponsorshipCommitmentId: "Select a confirmed Sponsorship Commitment." };
    if (!source.fundingProjectId) return { sponsorshipCommitmentId: "This commitment must be linked to a FundingProject before an award can be created." };
  }
  return {};
}
