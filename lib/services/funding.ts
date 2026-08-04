import { prisma } from "@/lib/db/prisma";
import { fundingStatusToDb } from "@/lib/funding/format";
import { createAuditLog } from "@/lib/repositories/audit-logs";
import { publishFundingNotification } from "@/lib/notifications";
import type {
  applicationDecisionSchema,
  createAssessmentSchema,
  createBeneficiaryListSchema,
  createBudgetSchema,
  createFundingApplicationSchema,
  createFundingCallSchema,
  createFundingProjectSchema,
  updateFundingCallSchema,
  updateFundingProposalSchema
} from "@/lib/validators/funding";
import type { z } from "zod";

function money(value: number) {
  return value.toFixed(2);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createFundingCall(input: z.infer<typeof createFundingCallSchema>, actorUserId: string, fundingOrganisationId?: string) {
  const organisationId = fundingOrganisationId ?? (await prisma.fundingOrganisation.findFirst({ orderBy: { name: "asc" } }))?.id;
  if (!organisationId) throw new Error("Funding organisation is required before creating a funding call.");
  const call = await prisma.fundingCall.create({
    data: {
      fundingOrganisationId: organisationId,
      referenceNumber: `FC-${Date.now()}`,
      title: input.title,
      type: input.type,
      description: input.description,
      minimumAmount: input.minimumAmount === undefined ? undefined : money(input.minimumAmount),
      maximumAmount: input.maximumAmount === undefined ? undefined : money(input.maximumAmount),
      closesAt: input.closesAt,
      requiredDocuments: input.requiredDocuments ?? [],
      focusAreas: input.focusAreas ?? [],
      eligibleRegions: input.eligibleRegions ?? [],
      status: "Open",
      publishedAt: new Date()
    }
  });
  await createAuditLog({ actorUserId, action: "funding.call.create", entityType: "FundingCall", entityId: call.id, after: call });
  return call;
}

export async function updateFundingCall(id: string, input: z.infer<typeof updateFundingCallSchema>, actorUserId: string) {
  const before = await prisma.fundingCall.findUnique({ where: { id } });
  const after = await prisma.fundingCall.update({
    where: { id },
    data: {
      title: input.title,
      type: input.type,
      description: input.description,
      minimumAmount: input.minimumAmount === undefined ? undefined : money(input.minimumAmount),
      maximumAmount: input.maximumAmount === undefined ? undefined : money(input.maximumAmount),
      closesAt: input.closesAt,
      requiredDocuments: input.requiredDocuments,
      focusAreas: input.focusAreas,
      eligibleRegions: input.eligibleRegions,
      status: input.status,
      featured: input.featured
    }
  });
  await createAuditLog({ actorUserId, action: "funding.call.update", entityType: "FundingCall", entityId: id, before, after });
  return after;
}

export async function archiveFundingCall(id: string, actorUserId: string) {
  const call = await prisma.fundingCall.update({ where: { id }, data: { status: "Archived", archivedAt: new Date() } });
  await createAuditLog({ actorUserId, action: "funding.call.archive", entityType: "FundingCall", entityId: id, after: call });
  return call;
}

export async function createCentreFundingProject(centreId: string, input: z.infer<typeof createFundingProjectSchema>, actorUserId: string) {
  const profile = await prisma.fundingProfile.upsert({
    where: { centreId },
    update: {},
    create: { centreId, readinessScore: 25, status: "IN_PROGRESS", readinessStatus: "IN_PROGRESS" }
  });
  const project = await prisma.fundingProject.create({
    data: {
      fundingProfileId: profile.id,
      title: input.title,
      slug: `${slugify(input.title)}-${Date.now()}`,
      opportunityType: input.opportunityType,
      funderType: input.funderType ?? input.opportunityType,
      objective: input.objective,
      requestedAmount: money(input.requestedAmount),
      fundingGap: money(input.requestedAmount),
      beneficiaries: input.beneficiaries,
      status: "DRAFT",
      createdByUserId: actorUserId
    }
  });
  await createAuditLog({ actorUserId, action: "funding.project.create", entityType: "FundingProject", entityId: project.id, after: project });
  return project;
}

export async function upsertFundingProposal(projectId: string, input: z.infer<typeof updateFundingProposalSchema>, actorUserId: string) {
  const existing = await prisma.fundingProposal.findFirst({ where: { projectId }, orderBy: { version: "desc" } });
  const data = {
    title: input.title ?? existing?.title ?? "Funding proposal",
    executiveSummary: input.executiveSummary,
    problemStatement: input.problemStatement,
    projectPlan: input.projectPlan,
    impactStatement: input.impactStatement,
    status: input.status ? fundingStatusToDb(input.status) : existing?.status ?? "DRAFT",
    createdByUserId: actorUserId
  };
  const proposal = existing ? await prisma.fundingProposal.update({ where: { id: existing.id }, data }) : await prisma.fundingProposal.create({ data: { ...data, projectId } });
  await createAuditLog({ actorUserId, action: "funding.proposal.upsert", entityType: "FundingProposal", entityId: proposal.id, after: proposal });
  return proposal;
}

export async function createProjectBudget(projectId: string, input: z.infer<typeof createBudgetSchema>, actorUserId: string) {
  const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0) || input.requestedAmount;
  const budget = await prisma.budget.create({
    data: {
      projectId,
      title: input.title,
      total: money(total),
      requestedAmount: money(input.requestedAmount),
      coFundingAmount: money(input.coFundingAmount ?? 0),
      createdByUserId: actorUserId,
      items: {
        create: input.items.map((item, index) => ({
          label: item.label,
          category: item.category,
          quantity: item.quantity,
          unitCost: money(item.unitCost),
          lineTotal: money(item.quantity * item.unitCost),
          justification: item.justification,
          displayOrder: index + 1
        }))
      }
    },
    include: { items: true }
  });
  await createAuditLog({ actorUserId, action: "funding.budget.create", entityType: "Budget", entityId: budget.id, after: budget });
  return budget;
}

export async function createProjectBeneficiaryList(projectId: string, input: z.infer<typeof createBeneficiaryListSchema>, actorUserId: string) {
  const list = await prisma.beneficiaryList.create({ data: { projectId, ...input, createdByUserId: actorUserId } });
  await createAuditLog({ actorUserId, action: "funding.beneficiaries.create", entityType: "BeneficiaryList", entityId: list.id, after: list });
  return list;
}

export async function createFundingApplication(input: z.infer<typeof createFundingApplicationSchema>, centreIds: string[], actorUserId: string) {
  const project = await prisma.fundingProject.findFirst({ where: { id: input.projectId, profile: { centreId: { in: centreIds } } }, include: { profile: true } });
  if (!project) throw new Error("Funding project was not found for the current centre.");
  const call = input.fundingCallId ? await prisma.fundingCall.findUnique({ where: { id: input.fundingCallId } }) : null;
  const application = await prisma.fundingApplication.create({
    data: {
      projectId: project.id,
      fundingCallId: call?.id,
      fundingOrganisationId: call?.fundingOrganisationId,
      applicationNumber: `FA-${Date.now()}`,
      requestedAmount: money(input.requestedAmount),
      readinessScoreAtSubmission: project.profile.readinessScore,
      submissionMethod: input.submissionMethod,
      externalReference: input.externalReference,
      status: "SUBMITTED",
      submittedAt: new Date(),
      createdByUserId: actorUserId
    }
  });
  await createAuditLog({ actorUserId, action: "funding.application.submit", entityType: "FundingApplication", entityId: application.id, after: application });
  await publishFundingNotification({ type: "FUNDING_APPLICATION_SUBMITTED", applicationId: application.id, actorUserId });
  return application;
}

export async function decideFundingApplication(applicationId: string, input: z.infer<typeof applicationDecisionSchema>, actorUserId: string) {
  const [before, actor] = await Promise.all([
    prisma.fundingApplication.findUnique({ where: { id: applicationId } }),
    prisma.user.findUnique({
      where: { id: actorUserId },
      include: { fundingUsers: { select: { fundingOrganisationId: true } } },
    }),
  ]);
  if (!before) throw new Error("Funding application was not found.");
  if (!actor || actor.status !== "ACTIVE" || !["SUPER_ADMIN", "FUNDING_ORGANISATION"].includes(actor.role)) {
    throw new Error("The acting user is not permitted to manage funding applications.");
  }

  const appendNote = (existing: string | null, note?: string) => {
    const trimmedNote = note?.trim();
    if (!trimmedNote) return undefined;
    return existing ? `${existing}\n${trimmedNote}` : trimmedNote;
  };

  if (input.action === "assign_reviewer") {
    const reviewer = await prisma.user.findUnique({
      where: { id: input.reviewerUserId },
      include: { fundingUsers: { select: { fundingOrganisationId: true } } },
    });
    const reviewerHasEligibleRole = reviewer && ["SUPER_ADMIN", "FUNDING_ORGANISATION"].includes(reviewer.role);
    const actorOrganisationIds = actor.fundingUsers.map((membership) => membership.fundingOrganisationId);
    const reviewerOrganisationIds = reviewer?.fundingUsers.map((membership) => membership.fundingOrganisationId) ?? [];
    const reviewerIsEligible = Boolean(
      reviewer &&
      reviewer.status === "ACTIVE" &&
      reviewerHasEligibleRole &&
      (actor.role === "SUPER_ADMIN" || (
        actor.role === "FUNDING_ORGANISATION" &&
        reviewer.role === "FUNDING_ORGANISATION" &&
        before.fundingOrganisationId &&
        actorOrganisationIds.includes(before.fundingOrganisationId) &&
        reviewerOrganisationIds.includes(before.fundingOrganisationId)
      ))
    );
    if (!reviewerIsEligible) {
      throw new Error("The selected reviewer is not eligible for this funding application.");
    }

    const after = await prisma.fundingApplication.update({
      where: { id: applicationId },
      data: {
        reviewedByUserId: reviewer!.id,
        notes: appendNote(before.notes, input.notes),
      },
    });
    await createAuditLog({
      actorUserId,
      action: "funding.application.reviewer.assigned",
      entityType: "FundingApplication",
      entityId: applicationId,
      before,
      after,
      metadata: {
        previousReviewerUserId: before.reviewedByUserId,
        newReviewerUserId: reviewer!.id,
        actorUserId,
      },
    });
    await publishFundingNotification({ type: "FUNDING_APPLICATION_REVIEWER_ASSIGNED", applicationId, actorUserId, reviewerUserId: reviewer!.id });
    return after;
  }

  if (!input.status) throw new Error("A decision status is required.");

  const isClarificationRequest = input.status === "Clarification Requested";
  if (
    isClarificationRequest &&
    (!before.submittedAt || ["APPROVED", "REJECTED", "WITHDRAWN"].includes(before.status))
  ) {
    throw new Error("Clarification can only be requested for an active submitted application.");
  }

  const isTerminalDecision = ["Approved", "Rejected"].includes(input.status);
  if (
    isTerminalDecision &&
    (!before.submittedAt ||
      ["APPROVED", "REJECTED", "WITHDRAWN"].includes(before.status) ||
      !["SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUESTED"].includes(before.status))
  ) {
    throw new Error("This application cannot be approved or rejected from its current status.");
  }

  const clarificationReason = isClarificationRequest ? input.notes?.trim() : undefined;
  const clarificationNote = clarificationReason ? `Clarification requested: ${clarificationReason}` : undefined;
  const decisionNote = clarificationNote ?? input.notes;
  const decisionDate = isTerminalDecision ? new Date() : undefined;
  const after = await prisma.fundingApplication.update({
    where: { id: applicationId },
    data: {
      status: fundingStatusToDb(input.status),
      approvedAmount: input.approvedAmount === undefined ? undefined : money(input.approvedAmount),
      rejectionReason: input.rejectionReason?.trim(),
      notes: appendNote(before.notes, decisionNote),
      reviewedByUserId: actorUserId,
      decidedAt: decisionDate,
      decisionDate
    }
  });
  await createAuditLog({
    actorUserId,
    action: isClarificationRequest
      ? "funding.application.clarification.requested"
      : input.status === "Approved"
        ? "funding.application.approved"
        : input.status === "Rejected"
          ? "funding.application.rejected"
          : "funding.application.decision",
    entityType: "FundingApplication",
    entityId: applicationId,
    before,
    after,
    metadata: clarificationReason ? { reason: clarificationReason } : undefined
  });
  if (isClarificationRequest) {
    await publishFundingNotification({ type: "FUNDING_APPLICATION_CLARIFICATION_REQUESTED", applicationId, actorUserId });
  } else if (input.status === "Approved") {
    await publishFundingNotification({ type: "FUNDING_APPLICATION_APPROVED", applicationId, actorUserId });
  } else if (input.status === "Rejected") {
    await publishFundingNotification({ type: "FUNDING_APPLICATION_REJECTED", applicationId, actorUserId });
  }
  return after;
}

export async function createFundingAssessment(input: z.infer<typeof createAssessmentSchema>, actorUserId: string, fundingOrganisationId?: string) {
  const scores = [input.eligibilityScore, input.complianceScore, input.projectQualityScore, input.budgetScore, input.impactScore].filter((score): score is number => typeof score === "number");
  const totalScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : undefined;
  const assessment = await prisma.fundingAssessment.create({
    data: {
      fundingCallId: input.fundingCallId,
      fundingApplicationId: input.fundingApplicationId,
      assessorUserId: actorUserId,
      fundingOrganisationId,
      eligibilityScore: input.eligibilityScore,
      complianceScore: input.complianceScore,
      projectQualityScore: input.projectQualityScore,
      budgetScore: input.budgetScore,
      impactScore: input.impactScore,
      totalScore,
      score: totalScore,
      recommendation: input.recommendation,
      notes: input.notes,
      status: "Assessed",
      assessedAt: new Date()
    }
  });
  await createAuditLog({ actorUserId, action: "funding.assessment.create", entityType: "FundingAssessment", entityId: assessment.id, after: assessment });
  return assessment;
}

export async function createFundingReminders(actorUserId: string) {
  const profiles = await prisma.fundingProfile.findMany({ where: { readinessScore: { lt: 80 } }, take: 50, include: { centre: true } });
  const reminders = await Promise.all(profiles.map((profile) => prisma.fundingReminder.create({
    data: {
      fundingProfileId: profile.id,
      title: "Funding readiness follow-up",
      body: `${profile.centre.centreName} needs support to complete funding readiness actions.`,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  })));
  await createAuditLog({ actorUserId, action: "funding.reminders.create", entityType: "FundingReminder", metadata: { count: reminders.length } });
  return reminders;
}
