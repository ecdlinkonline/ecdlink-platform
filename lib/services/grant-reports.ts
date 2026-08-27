import type { Prisma } from "@prisma/client";
import { withGrantReportingTransaction } from "@/lib/repositories/grant-reports";
import type { CreateGrantAwardInput, CreateGrantReportingObligationInput } from "@/lib/validators/grant-reports";

export class GrantReportingServiceError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function acceptableCommitmentStatus(status: string) {
  return ["CONFIRMED", "PARTIALLY_FULFILLED", "FULFILLED"].includes(status.trim().toUpperCase().replaceAll(" ", "_"));
}

export type GrantReportingTransactionRunner = <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;

export async function createGrantAward(input: CreateGrantAwardInput, actorUserId: string, runTransaction: GrantReportingTransactionRunner = withGrantReportingTransaction) {
  return runTransaction(async (tx) => {
    const project = await tx.fundingProject.findUnique({ where: { id: input.fundingProjectId }, select: { id: true, profile: { select: { centreId: true } } } });
    if (!project || project.profile.centreId !== input.centreId) throw new GrantReportingServiceError("The selected project does not belong to the selected centre.", 422);

    if (input.sourceType === "FUNDING_APPLICATION") {
      const application = await tx.fundingApplication.findUnique({ where: { id: input.fundingApplicationId! }, select: { id: true, status: true, projectId: true, fundingOrganisationId: true, grantAward: { select: { id: true } }, project: { select: { profile: { select: { centreId: true } } } } } });
      if (!application) throw new GrantReportingServiceError("Funding application not found.", 404);
      if (application.grantAward) throw new GrantReportingServiceError("This funding application has already been converted to an award.", 409);
      if (application.status !== "APPROVED") throw new GrantReportingServiceError("Only approved funding applications can be converted to an award.", 422);
      if (application.projectId !== input.fundingProjectId || application.project.profile.centreId !== input.centreId || input.organisationType !== "FUNDING_ORGANISATION" || application.fundingOrganisationId !== input.fundingOrganisationId) throw new GrantReportingServiceError("The funding application, centre, project and funder relationship does not match.", 422);
    }

    if (input.sourceType === "SPONSORSHIP_COMMITMENT") {
      const commitment = await tx.sponsorshipCommitment.findUnique({ where: { id: input.sponsorshipCommitmentId! }, select: { id: true, centreId: true, donorOrganisationId: true, commitmentStatus: true, grantAward: { select: { id: true } }, project: { select: { fundingProjectId: true } } } });
      if (!commitment) throw new GrantReportingServiceError("Sponsorship commitment not found.", 404);
      if (commitment.grantAward) throw new GrantReportingServiceError("This sponsorship commitment has already been converted to an award.", 409);
      if (!acceptableCommitmentStatus(commitment.commitmentStatus)) throw new GrantReportingServiceError("Only confirmed or fulfilled sponsorship commitments can be converted to an award.", 422);
      if (!commitment.project?.fundingProjectId) throw new GrantReportingServiceError("The sponsorship commitment must be linked to a FundingProject before conversion.", 422);
      if (commitment.centreId !== input.centreId || commitment.project.fundingProjectId !== input.fundingProjectId || input.organisationType !== "DONOR_ORGANISATION" || commitment.donorOrganisationId !== input.donorOrganisationId) throw new GrantReportingServiceError("The sponsorship commitment, centre, project and donor relationship does not match.", 422);
    }

    if (input.sourceType === "MANUAL" && (input.fundingApplicationId || input.sponsorshipCommitmentId)) throw new GrantReportingServiceError("Manual awards cannot include a source record.", 422);

    const organisation = input.organisationType === "FUNDING_ORGANISATION"
      ? await tx.fundingOrganisation.findUnique({ where: { id: input.fundingOrganisationId! }, select: { id: true } })
      : await tx.donorOrganisation.findUnique({ where: { id: input.donorOrganisationId! }, select: { id: true } });
    if (!organisation) throw new GrantReportingServiceError("The selected lead organisation was not found.", 404);

    const duplicateNumber = await tx.grantAward.findUnique({ where: { awardNumber: input.awardNumber }, select: { id: true } });
    if (duplicateNumber) throw new GrantReportingServiceError("An award with this award number already exists.", 409);

    const award = await tx.grantAward.create({
      data: {
        centreId: input.centreId,
        fundingProjectId: input.fundingProjectId,
        sourceType: input.sourceType,
        fundingApplicationId: input.sourceType === "FUNDING_APPLICATION" ? input.fundingApplicationId : null,
        sponsorshipCommitmentId: input.sourceType === "SPONSORSHIP_COMMITMENT" ? input.sponsorshipCommitmentId : null,
        awardNumber: input.awardNumber,
        title: input.title,
        description: input.description,
        awardedAmount: input.awardedAmount,
        currency: input.currency,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "ACTIVE",
        confirmedByUserId: actorUserId,
      },
    });
    const party = await tx.grantAwardOrganisation.create({ data: { grantAwardId: award.id, organisationType: input.organisationType, fundingOrganisationId: input.fundingOrganisationId, donorOrganisationId: input.donorOrganisationId, role: input.organisationRole, isPrimary: true, canReview: input.canReview, canApprove: input.canApprove, addedByUserId: actorUserId } });
    await tx.auditLog.create({ data: { actorUserId, action: "grant.award.create", entityType: "GrantAward", entityId: award.id, after: json({ award, party }), metadata: json({ sourceType: input.sourceType }) } });
    return award;
  });
}

export async function createGrantReportingObligation(input: CreateGrantReportingObligationInput, actorUserId: string, runTransaction: GrantReportingTransactionRunner = withGrantReportingTransaction) {
  return runTransaction(async (tx) => {
    const [award, actor] = await Promise.all([
      tx.grantAward.findUnique({ where: { id: input.grantAwardId }, select: { id: true, currency: true } }),
      tx.user.findUnique({ where: { id: actorUserId }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    if (!award) throw new GrantReportingServiceError("Grant award not found.", 404);
    if (!actor) throw new GrantReportingServiceError("The internal audit actor was not found.", 403);

    let tranche: { id: string; trancheNumber: number; scheduledAmount: Prisma.Decimal } | null = null;
    if (input.grantTrancheId) {
      tranche = await tx.grantTranche.findFirst({ where: { id: input.grantTrancheId, grantAwardId: input.grantAwardId }, select: { id: true, trancheNumber: true, scheduledAmount: true } });
      if (!tranche) throw new GrantReportingServiceError("The selected tranche does not belong to this award.", 422);
    }

    const obligation = await tx.grantReportingObligation.create({ data: { grantAwardId: input.grantAwardId, grantTrancheId: input.grantTrancheId, type: input.type, basis: input.basis, title: input.title, description: input.description, reportingPeriodStart: input.reportingPeriodStart, reportingPeriodEnd: input.reportingPeriodEnd, financialYear: input.financialYear, quarter: input.quarter, dueAt: input.dueAt, status: "OPEN", requiresFunderApproval: input.requiresFunderApproval, requiresSuperAdminApproval: input.requiresSuperAdminApproval, createdByUserId: actorUserId } });
    const report = await tx.grantReport.create({ data: { grantAwardId: award.id, obligationId: obligation.id, status: "DRAFT", currentVersionNumber: 1, createdByUserId: actorUserId, versions: { create: { versionNumber: 1, status: "DRAFT", reportType: input.type, reportingPeriodStart: input.reportingPeriodStart, reportingPeriodEnd: input.reportingPeriodEnd, financialYear: input.financialYear, quarter: input.quarter, trancheNumberSnapshot: tranche?.trancheNumber, trancheAmountSnapshot: tranche?.scheduledAmount, currency: award.currency, preparedByUserId: actorUserId, preparerNameSnapshot: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || "Super Admin", preparerDesignationSnapshot: "Super Admin", certificationAcknowledged: false } } } });
    await tx.auditLog.create({ data: { actorUserId, action: "grant.reporting_obligation.create", entityType: "GrantReportingObligation", entityId: obligation.id, after: json(obligation), metadata: json({ grantAwardId: award.id, reportId: report.id, initialVersion: 1 }) } });
    return { obligation, report };
  });
}
