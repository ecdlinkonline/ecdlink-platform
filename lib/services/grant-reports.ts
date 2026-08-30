import { Prisma } from "@prisma/client";
import { findMatchingQuarterlyExpenditureIncome, getGrantReportEditor, withGrantReportingTransaction } from "@/lib/repositories/grant-reports";
import type { CreateGrantAwardInput, CreateGrantReportingObligationInput, SaveGrantReportSectionInput } from "@/lib/validators/grant-reports";
import { GRANT_AWARD_STAGING_ENTITY } from "@/lib/services/grant-award-agreements";

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

    let agreement: { id: string; originalFilename: string; mimeType: string; fileSize: number } | null = null;
    if (input.signedAgreementFileAssetId) {
      const staged = await tx.fileAsset.findFirst({
        where: { id: input.signedAgreementFileAssetId, uploadedByUserId: actorUserId },
        select: { id: true, storageKey: true, originalFilename: true, mimeType: true, fileSize: true, grantAwardSignedAgreement: { select: { id: true } } },
      });
      const expectedPrefix = `funding/${actorUserId}/${GRANT_AWARD_STAGING_ENTITY}/${input.signedAgreementFileAssetId}/`;
      if (!staged || staged.mimeType !== "application/pdf" || !staged.storageKey.startsWith(expectedPrefix) || staged.grantAwardSignedAgreement) {
        throw new GrantReportingServiceError("The staged signed agreement is invalid or unavailable.", 422);
      }
      agreement = staged;
    }

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
        signedAgreementFileAssetId: agreement?.id,
        agreementDate: input.agreementDate,
        signedByBothParties: input.signedByBothParties,
        status: "ACTIVE",
        confirmedByUserId: actorUserId,
      },
    });
    const party = await tx.grantAwardOrganisation.create({ data: { grantAwardId: award.id, organisationType: input.organisationType, fundingOrganisationId: input.fundingOrganisationId, donorOrganisationId: input.donorOrganisationId, role: "LEAD_FUNDER", isPrimary: true, canReview: input.canReview, canApprove: input.canApprove, addedByUserId: actorUserId } });
    await tx.auditLog.create({ data: { actorUserId, action: "grant.award.create", entityType: "GrantAward", entityId: award.id, after: json({ award, party }), metadata: json({ sourceType: input.sourceType, signedAgreementFileAssetId: agreement?.id ?? null }) } });
    if (agreement) {
      await tx.auditLog.create({ data: { actorUserId, action: "grant.award.agreement.attached", entityType: "GrantAward", entityId: award.id, after: json({ signedAgreementFileAssetId: agreement.id, agreementDate: input.agreementDate, signedByBothParties: input.signedByBothParties }), metadata: json({ fileAssetId: agreement.id, originalFilename: agreement.originalFilename, mimeType: agreement.mimeType, fileSize: agreement.fileSize }) } });
    }
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

const certificationConfirmationText = "I confirm that the information in this grant report is accurate and complete to the best of my knowledge.";

export async function requireMutableGrantReport(tx: Prisma.TransactionClient, reportId: string) {
  const report = await tx.grantReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      currentVersionNumber: true,
      award: {
        select: {
          id: true,
          awardNumber: true,
          title: true,
          awardedAmount: true,
          currency: true,
          centre: { select: { id: true, centreName: true, npoNumber: true, physicalAddress: true, suburb: true, area: true, province: true, postalCode: true, contactPerson: true, phone: true, email: true } },
          fundingProject: { select: { id: true, title: true, objective: true, expectedOutcomes: true, requiredItems: true } },
          organisations: { where: { removedAt: null }, orderBy: [{ isPrimary: "desc" as const }, { addedAt: "asc" as const }], include: { fundingOrganisation: { select: { id: true, name: true } }, donorOrganisation: { select: { id: true, name: true, organisationName: true } } } },
        },
      },
      obligation: { select: { financialYear: true, quarter: true, tranche: { select: { id: true, trancheNumber: true, scheduledAmount: true, title: true } } } },
    },
  });
  if (!report) throw new GrantReportingServiceError("Grant report not found.", 404);
  const version = await tx.grantReportVersion.findUnique({ where: { grantReportId_versionNumber: { grantReportId: report.id, versionNumber: report.currentVersionNumber } } });
  if (!version) throw new GrantReportingServiceError("The current report version was not found.", 404);
  if (version.status !== "DRAFT" || ["SUBMITTED", "APPROVED", "ARCHIVED"].includes(report.status)) {
    throw new GrantReportingServiceError("This report version is immutable and cannot be edited.", 409);
  }
  if (!["INTERIM", "FINAL", "QUARTERLY_EXPENDITURE", "QUARTERLY_CASH_FLOW"].includes(version.reportType)) {
    throw new GrantReportingServiceError("This report template is not available for editing.", 422);
  }
  return { report, version };
}

export async function saveGrantReportSection(
  reportId: string,
  input: SaveGrantReportSectionInput,
  actorUserId: string,
  runTransaction: GrantReportingTransactionRunner = withGrantReportingTransaction,
  reload: typeof getGrantReportEditor = getGrantReportEditor,
) {
  await runTransaction(async (tx) => {
    const { report, version } = await requireMutableGrantReport(tx, reportId);
    const nlcSections = ["general", "objectives", "beneficiaries", "sustainability", "financial", "certification"];
    const quarterlySections = ["quarterly_general", "quarterly_income", "quarterly_expenditure", "bank_reconciliation", "certification"];
    const cashFlowSections = ["cash_flow_general", "cash_received", "operating_expenses", "certification"];
    const allowedSections = version.reportType === "QUARTERLY_EXPENDITURE" ? quarterlySections : version.reportType === "QUARTERLY_CASH_FLOW" ? cashFlowSections : nlcSections;
    if (!allowedSections.includes(input.section)) throw new GrantReportingServiceError("This section does not belong to the selected report type.", 422);

    let effectiveTotalIncome = version.totalIncome;
    if (version.reportType === "QUARTERLY_CASH_FLOW" && input.section !== "cash_received") {
      const existingCashReceived = await tx.grantReportFinancialLine.findMany({ where: { grantReportVersionId: version.id, lineType: { in: ["FUNDING_RECEIVED", "OTHER_INCOME"] } }, select: { id: true }, take: 1 });
      const financialYear = input.section === "cash_flow_general" ? input.data.financialYear : version.financialYear ?? report.obligation.financialYear;
      const quarter = input.section === "cash_flow_general" ? input.data.quarter : version.quarter ?? report.obligation.quarter;
      if (!existingCashReceived.length && financialYear && quarter) {
        const source = await findMatchingQuarterlyExpenditureIncome({ grantAwardId: report.award.id, centreId: report.award.centre.id, financialYear, quarter }, tx);
        if (source?.rows.length) {
          for (const [displayOrder, row] of source.rows.entries()) await tx.grantReportFinancialLine.create({ data: { grantReportVersionId: version.id, lineType: row.lineType, categoryName: row.categoryName, quarterlyActual: row.amount, displayOrder } });
          const fundingReceivedTotal = source.rows.filter((row) => row.lineType === "FUNDING_RECEIVED").reduce((total, row) => total.plus(row.amount ?? 0), new Prisma.Decimal(0));
          const otherIncomeTotal = source.rows.filter((row) => row.lineType === "OTHER_INCOME").reduce((total, row) => total.plus(row.amount ?? 0), new Prisma.Decimal(0));
          const totalIncome = fundingReceivedTotal.plus(otherIncomeTotal);
          effectiveTotalIncome = totalIncome;
          await tx.grantReportVersion.update({ where: { id: version.id }, data: { fundingReceivedTotal, otherIncomeTotal, totalIncome, surplusDeficit: totalIncome.minus(version.totalExpenditure) } });
        }
      }
    }

    if (input.section === "quarterly_general" || input.section === "cash_flow_general") {
      const centre = report.award.centre;
      const project = report.award.fundingProject;
      const lead = report.award.organisations[0];
      const leadName = lead?.fundingOrganisation?.name ?? lead?.donorOrganisation?.organisationName ?? lead?.donorOrganisation?.name ?? null;
      const physicalAddress = [centre.physicalAddress, centre.suburb, centre.area, centre.province, centre.postalCode].filter(Boolean).join(", ") || null;
      await tx.grantReportVersion.update({
        where: { id: version.id },
        data: {
          financialYear: input.data.financialYear,
          quarter: input.data.quarter,
          reportingPeriodStart: new Date(`${input.data.reportingPeriodStart}T00:00:00.000Z`),
          reportingPeriodEnd: new Date(`${input.data.reportingPeriodEnd}T00:00:00.000Z`),
          centreSnapshot: version.centreSnapshot ?? json({ id: centre.id, centreName: centre.centreName, npoNumber: centre.npoNumber, physicalAddress, contactPerson: centre.contactPerson, phone: centre.phone, email: centre.email }),
          projectSnapshot: version.projectSnapshot ?? json({ id: project.id, title: project.title, objective: project.objective, expectedOutcomes: project.expectedOutcomes, requiredItems: project.requiredItems }),
          awardSnapshot: version.awardSnapshot ?? json({ id: report.award.id, awardNumber: report.award.awardNumber, title: report.award.title, awardedAmount: report.award.awardedAmount, currency: report.award.currency }),
          fundingOrganisationSnapshot: version.fundingOrganisationSnapshot ?? json({ name: leadName, organisationType: lead?.organisationType ?? null, fundingOrganisationId: lead?.fundingOrganisationId ?? null, donorOrganisationId: lead?.donorOrganisationId ?? null }),
        },
      });
    } else if (input.section === "general") {
      const centre = report.award.centre;
      const project = report.award.fundingProject;
      const lead = report.award.organisations[0];
      const leadName = lead?.fundingOrganisation?.name ?? lead?.donorOrganisation?.organisationName ?? lead?.donorOrganisation?.name ?? null;
      const physicalAddress = [centre.physicalAddress, centre.suburb, centre.area, centre.province, centre.postalCode].filter(Boolean).join(", ") || null;
      await tx.grantReportVersion.update({
        where: { id: version.id },
        data: {
          reportingPeriodStart: input.data.reportingPeriodStart ? new Date(`${input.data.reportingPeriodStart}T00:00:00.000Z`) : null,
          reportingPeriodEnd: input.data.reportingPeriodEnd ? new Date(`${input.data.reportingPeriodEnd}T00:00:00.000Z`) : null,
          previousTrancheBalance: input.data.previousTrancheBalance,
          centreSnapshot: version.centreSnapshot ?? json({ id: centre.id, centreName: centre.centreName, npoNumber: centre.npoNumber, physicalAddress, contactPerson: centre.contactPerson, phone: centre.phone, email: centre.email }),
          projectSnapshot: version.projectSnapshot ?? json({ id: project.id, title: project.title, objective: project.objective, expectedOutcomes: project.expectedOutcomes, requiredItems: project.requiredItems }),
          awardSnapshot: version.awardSnapshot ?? json({ id: report.award.id, awardNumber: report.award.awardNumber, title: report.award.title, awardedAmount: report.award.awardedAmount, currency: report.award.currency }),
          fundingOrganisationSnapshot: version.fundingOrganisationSnapshot ?? json({ name: leadName, organisationType: lead?.organisationType ?? null, fundingOrganisationId: lead?.fundingOrganisationId ?? null, donorOrganisationId: lead?.donorOrganisationId ?? null }),
          trancheSnapshot: version.trancheSnapshot ?? (report.obligation.tranche ? json({ id: report.obligation.tranche.id, trancheNumber: report.obligation.tranche.trancheNumber, scheduledAmount: report.obligation.tranche.scheduledAmount, title: report.obligation.tranche.title }) : undefined),
        },
      });
    } else if (input.section === "objectives") {
      const existing = await tx.grantReportIndicator.findMany({ where: { grantReportVersionId: version.id }, select: { id: true, _count: { select: { documents: true } } } });
      const requestedIds = input.data.rows.flatMap((row) => row.id ? [row.id] : []);
      if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((id) => !existing.some((row) => row.id === id))) throw new GrantReportingServiceError("One or more indicator rows do not belong to this report version.", 422);
      const removed = existing.filter((row) => !requestedIds.includes(row.id));
      if (removed.some((row) => row._count.documents > 0)) throw new GrantReportingServiceError("An indicator with linked evidence cannot be removed.", 409);
      if (removed.length) await tx.grantReportIndicator.deleteMany({ where: { id: { in: removed.map((row) => row.id) }, grantReportVersionId: version.id } });
      for (const [displayOrder, row] of input.data.rows.entries()) {
        const data = { objective: row.objective, deliverable: row.deliverable, indicator: row.deliverable || row.objective, achieved: row.achieved, status: row.status, meansOfVerification: row.meansOfVerification, displayOrder };
        if (row.id) await tx.grantReportIndicator.update({ where: { id: row.id }, data });
        else await tx.grantReportIndicator.create({ data: { ...data, grantReportVersionId: version.id } });
      }
    } else if (input.section === "beneficiaries") {
      await tx.grantReportBeneficiaryBreakdown.deleteMany({ where: { grantReportVersionId: version.id } });
      await tx.grantReportRacialProfileRow.deleteMany({ where: { grantReportVersionId: version.id } });
      await tx.grantReportBeneficiaryBreakdown.createMany({ data: input.data.beneficiaries.map((row, displayOrder) => ({ ...row, grantReportVersionId: version.id, displayOrder })) });
      await tx.grantReportRacialProfileRow.createMany({ data: input.data.racialRows.map((row, displayOrder) => ({ ...row, grantReportVersionId: version.id, displayOrder })) });
    } else if (input.section === "sustainability") {
      await tx.grantReportVersion.update({ where: { id: version.id }, data: { challenges: input.data.challenges, organisationalChanges: input.data.organisationalChanges, communityChanges: input.data.communityChanges } });
      await tx.grantReportSustainabilityItem.deleteMany({ where: { grantReportVersionId: version.id } });
      if (input.data.rows.length) await tx.grantReportSustainabilityItem.createMany({ data: input.data.rows.map((row, displayOrder) => ({ grantReportVersionId: version.id, plan: row.plan, progressToDate: row.progressToDate, displayOrder })) });
    } else if (input.section === "financial") {
      await tx.grantReportVersion.update({ where: { id: version.id }, data: { fundingReceivedTotal: input.data.fundingReceivedTotal, previousTrancheBalance: input.data.previousTrancheBalance, quarterlyExpenditureTotal: input.data.quarterlyExpenditureTotal } });
      const existing = await tx.grantReportFinancialLine.findMany({ where: { grantReportVersionId: version.id }, select: { id: true, _count: { select: { documents: true, expenseEntries: true } } } });
      const requestedIds = input.data.rows.flatMap((row) => row.id ? [row.id] : []);
      if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((id) => !existing.some((row) => row.id === id))) throw new GrantReportingServiceError("One or more financial rows do not belong to this report version.", 422);
      const removed = existing.filter((row) => !requestedIds.includes(row.id));
      if (removed.some((row) => row._count.documents > 0 || row._count.expenseEntries > 0)) throw new GrantReportingServiceError("A financial row with linked evidence or expense entries cannot be removed.", 409);
      if (removed.length) await tx.grantReportFinancialLine.deleteMany({ where: { id: { in: removed.map((row) => row.id) }, grantReportVersionId: version.id } });
      for (const [displayOrder, row] of input.data.rows.entries()) {
        const data = { lineType: "EXPENDITURE" as const, categoryName: row.categoryName, description: row.description, approvedBudget: row.approvedBudget, quarterlyActual: row.quarterlyActual, displayOrder };
        if (row.id) await tx.grantReportFinancialLine.update({ where: { id: row.id }, data });
        else await tx.grantReportFinancialLine.create({ data: { ...data, grantReportVersionId: version.id } });
      }
    } else if (input.section === "quarterly_income" || input.section === "cash_received") {
      const existing = await tx.grantReportFinancialLine.findMany({ where: { grantReportVersionId: version.id, lineType: { in: ["FUNDING_RECEIVED", "OTHER_INCOME"] } }, select: { id: true, _count: { select: { documents: true, expenseEntries: true } } } });
      const requestedIds = input.data.rows.flatMap((row) => row.id ? [row.id] : []);
      if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((id) => !existing.some((row) => row.id === id))) throw new GrantReportingServiceError("One or more income rows do not belong to this report version.", 422);
      const removed = existing.filter((row) => !requestedIds.includes(row.id));
      if (removed.some((row) => row._count.documents > 0 || row._count.expenseEntries > 0)) throw new GrantReportingServiceError("An income row with linked evidence or expense entries cannot be removed.", 409);
      if (removed.length) await tx.grantReportFinancialLine.deleteMany({ where: { id: { in: removed.map((row) => row.id) }, grantReportVersionId: version.id } });
      for (const [displayOrder, row] of input.data.rows.entries()) {
        const data = { lineType: row.lineType, categoryName: row.categoryName, quarterlyActual: row.amount, displayOrder };
        if (row.id) await tx.grantReportFinancialLine.update({ where: { id: row.id }, data });
        else await tx.grantReportFinancialLine.create({ data: { ...data, grantReportVersionId: version.id } });
      }
      const fundingReceivedTotal = input.data.rows.filter((row) => row.lineType === "FUNDING_RECEIVED").reduce((total, row) => total.plus(row.amount ?? 0), new Prisma.Decimal(0));
      const otherIncomeTotal = input.data.rows.filter((row) => row.lineType === "OTHER_INCOME").reduce((total, row) => total.plus(row.amount ?? 0), new Prisma.Decimal(0));
      const totalIncome = fundingReceivedTotal.plus(otherIncomeTotal);
      await tx.grantReportVersion.update({ where: { id: version.id }, data: { fundingReceivedTotal, otherIncomeTotal, totalIncome, surplusDeficit: totalIncome.minus(version.totalExpenditure) } });
    } else if (input.section === "quarterly_expenditure") {
      const existing = await tx.grantReportFinancialLine.findMany({ where: { grantReportVersionId: version.id, lineType: "EXPENDITURE" }, select: { id: true, _count: { select: { documents: true, expenseEntries: true } } } });
      const requestedIds = input.data.rows.flatMap((row) => row.id ? [row.id] : []);
      if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((id) => !existing.some((row) => row.id === id))) throw new GrantReportingServiceError("One or more expenditure rows do not belong to this report version.", 422);
      const removed = existing.filter((row) => !requestedIds.includes(row.id));
      if (removed.some((row) => row._count.documents > 0 || row._count.expenseEntries > 0)) throw new GrantReportingServiceError("An expenditure row with linked evidence or expense entries cannot be removed.", 409);
      if (removed.length) await tx.grantReportFinancialLine.deleteMany({ where: { id: { in: removed.map((row) => row.id) }, grantReportVersionId: version.id } });
      for (const [displayOrder, row] of input.data.rows.entries()) {
        const quarterlyActual = new Prisma.Decimal(row.fundingSourceActual ?? 0).plus(row.otherSourceActual ?? 0);
        const data = { lineType: "EXPENDITURE" as const, categoryName: row.categoryName, costingFrameworkPercentage: row.costingFrameworkPercentage, quarterlyBudget: row.quarterlyBudget, fundingSourceActual: row.fundingSourceActual, otherSourceActual: row.otherSourceActual, quarterlyActual, displayOrder };
        if (row.id) await tx.grantReportFinancialLine.update({ where: { id: row.id }, data });
        else await tx.grantReportFinancialLine.create({ data: { ...data, grantReportVersionId: version.id } });
      }
      const totalExpenditure = input.data.rows.reduce((total, row) => total.plus(row.fundingSourceActual ?? 0).plus(row.otherSourceActual ?? 0), new Prisma.Decimal(0));
      await tx.grantReportVersion.update({ where: { id: version.id }, data: { quarterlyExpenditureTotal: totalExpenditure, totalExpenditure, surplusDeficit: version.totalIncome.minus(totalExpenditure) } });
    } else if (input.section === "operating_expenses") {
      if (!new Prisma.Decimal(input.data.totalCashAvailable).equals(effectiveTotalIncome)) throw new GrantReportingServiceError("Total cash available does not match the saved cash received section.", 422);
      const existing = await tx.grantReportFinancialLine.findMany({ where: { grantReportVersionId: version.id, lineType: "EXPENDITURE" }, select: { id: true, _count: { select: { documents: true, expenseEntries: true } } } });
      const requestedIds = input.data.rows.flatMap((row) => row.id ? [row.id] : []);
      if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((id) => !existing.some((row) => row.id === id))) throw new GrantReportingServiceError("One or more operating expense rows do not belong to this report version.", 422);
      const removed = existing.filter((row) => !requestedIds.includes(row.id));
      if (removed.some((row) => row._count.documents > 0 || row._count.expenseEntries > 0)) throw new GrantReportingServiceError("An operating expense row with linked evidence or expense entries cannot be removed.", 409);
      if (removed.length) await tx.grantReportFinancialLine.deleteMany({ where: { id: { in: removed.map((row) => row.id) }, grantReportVersionId: version.id } });
      for (const [displayOrder, row] of input.data.rows.entries()) {
        const variance = new Prisma.Decimal(row.quarterlyBudget ?? 0).minus(row.estimatedExpenditure ?? 0);
        const data = { lineType: "EXPENDITURE" as const, categoryName: row.categoryName, quarterlyBudget: row.quarterlyBudget, estimatedExpenditure: row.estimatedExpenditure, quarterlyActual: row.estimatedExpenditure, variance, reasonForVariance: row.reasonForVariance, displayOrder };
        if (row.id) await tx.grantReportFinancialLine.update({ where: { id: row.id }, data });
        else await tx.grantReportFinancialLine.create({ data: { ...data, grantReportVersionId: version.id } });
      }
      const totalExpenditure = input.data.rows.reduce((total, row) => total.plus(row.estimatedExpenditure ?? 0), new Prisma.Decimal(0));
      await tx.grantReportVersion.update({ where: { id: version.id }, data: { quarterlyExpenditureTotal: totalExpenditure, totalExpenditure, surplusDeficit: effectiveTotalIncome.minus(totalExpenditure) } });
    } else if (input.section === "bank_reconciliation") {
      await tx.grantReportVersion.update({ where: { id: version.id }, data: { openingBankBalance: input.data.openingBankBalance, closingBankBalance: input.data.closingBankBalance } });
    } else if (input.section === "certification") {
      const confirmedAt = new Date();
      await tx.grantReportCertification.deleteMany({ where: { grantReportVersionId: version.id } });
      await tx.grantReportCertification.createMany({ data: input.data.rows.map((row, displayOrder) => ({
        grantReportVersionId: version.id,
        party: row.party,
        nameSnapshot: row.nameSnapshot,
        designationSnapshot: row.designationSnapshot,
        certificationDate: row.certificationDate ? new Date(`${row.certificationDate}T00:00:00.000Z`) : null,
        digitallyConfirmed: row.digitallyConfirmed,
        confirmedByUserId: row.digitallyConfirmed ? actorUserId : null,
        confirmedAt: row.digitallyConfirmed ? confirmedAt : null,
        confirmationTextSnapshot: row.digitallyConfirmed ? certificationConfirmationText : null,
        displayOrder,
      })) });
      const allConfirmed = input.data.rows.every((row) => row.digitallyConfirmed);
      await tx.grantReportVersion.update({ where: { id: version.id }, data: { certificationAcknowledged: allConfirmed, certificationTextSnapshot: allConfirmed ? certificationConfirmationText : null } });
    }
    await tx.auditLog.create({ data: { actorUserId, action: "grant.report.section.saved", entityType: "GrantReportVersion", entityId: version.id, metadata: json({ reportId, versionNumber: version.versionNumber, section: input.section }) } });
  });
  const updated = await reload(reportId);
  if (!updated) throw new GrantReportingServiceError("The updated report could not be loaded.", 500);
  return updated;
}
