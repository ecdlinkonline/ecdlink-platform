import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/repositories/audit-logs";
import type { IntelligenceScope } from "@/lib/api/intelligence-auth";
import { decimalNumber, insightWhereForScope, recommendationWhereForScope, responseDto, toPlain } from "@/lib/repositories/intelligence";
import type { AiInsight, MockAiResponse } from "@/lib/intelligence/types";

function money(value: number) {
  return value.toFixed(2);
}

function source(sourceType: string, sourceId: string, sourceLabel: string, module: string, relationship = "contributed") {
  return { sourceType, sourceId, sourceLabel, module, relationship };
}

function roleWhere(scope: IntelligenceScope) {
  if (scope.isPlatformWide) return {};
  if (scope.centreIds.length) return { centreId: { in: scope.centreIds } };
  if (scope.supplierIds.length) return { supplierId: { in: scope.supplierIds } };
  if (scope.donorOrganisationIds.length) return { donorOrganisationId: { in: scope.donorOrganisationIds } };
  if (scope.fundingOrganisationIds.length) return { fundingOrganisationId: { in: scope.fundingOrganisationIds } };
  return { id: "__none__" };
}

export async function getRoleInsightsFromDb(scope: IntelligenceScope): Promise<AiInsight[]> {
  const insights = await prisma.intelligenceInsight.findMany({ where: insightWhereForScope(scope), orderBy: [{ severity: "desc" }, { detectedAt: "desc" }], take: 4 });
  if (insights.length) {
    return insights.map((insight) => ({
      id: insight.id,
      title: insight.title,
      value: String((insight.metadata as any)?.value ?? insight.severity.replaceAll("_", " ")),
      description: insight.summary,
      tone: ["CRITICAL", "HIGH", "MEDIUM"].includes(insight.severity) ? "warning" : "green"
    }));
  }

  const [centres, memberships, complianceDocuments, orders] = await Promise.all([
    prisma.ecdCentre.count({ where: scope.isPlatformWide ? {} : { id: { in: scope.centreIds } } }),
    prisma.membership.count({ where: scope.isPlatformWide ? { status: "ACTIVE" } : { centreId: { in: scope.centreIds }, status: "ACTIVE" } }),
    prisma.complianceDocument.count({ where: scope.isPlatformWide ? { status: { in: ["EXPIRED", "MISSING", "REJECTED"] } } : { centreId: { in: scope.centreIds }, status: { in: ["EXPIRED", "MISSING", "REJECTED"] } } }),
    prisma.procurementOrder.count({ where: scope.isPlatformWide ? {} : { centreId: { in: scope.centreIds } } })
  ]);

  return [
    { id: "centres", title: "Centres in scope", value: String(centres), description: "Records visible to this role.", tone: "navy" },
    { id: "memberships", title: "Active memberships", value: String(memberships), description: "Memberships in good standing.", tone: memberships ? "green" : "warning" },
    { id: "compliance", title: "Compliance risks", value: String(complianceDocuments), description: "Missing, rejected or expired records.", tone: complianceDocuments ? "warning" : "green" },
    { id: "orders", title: "Procurement orders", value: String(orders), description: "Visible order history.", tone: "green" }
  ];
}

export async function buildDeterministicResponse(queryText: string, scope: IntelligenceScope): Promise<MockAiResponse & { sources?: ReturnType<typeof source>[]; category?: string; responseType?: string }> {
  const normalized = queryText.toLowerCase();
  const warnings = ["Deterministic rules engine output. Human review is required before operational action."];

  if (normalized.includes("expired compliance") || normalized.includes("missing mandatory") || normalized.includes("missing documents")) {
    const gaps = await getComplianceGaps(scope);
    return {
      title: "Compliance Gap Analysis",
      summary: gaps.summary,
      answer: gaps.summary,
      bullets: gaps.items.slice(0, 8).map((item) => `${item.centreName}: ${item.label} (${item.status})`),
      recommendations: gaps.recommendedActions.map((action, index) => ({ id: `compliance-action-${index}`, title: action, description: "Prioritised from live compliance records.", actionLabel: "Review compliance" })),
      confidenceLevel: 82,
      dataFreshnessDate: new Date().toISOString(),
      requiresHumanReview: true,
      warnings,
      sourceReferences: gaps.sources,
      sources: gaps.sources.map((item) => source(item.sourceType, item.sourceId, item.sourceLabel, item.module, item.relationship)),
      category: "Compliance",
      responseType: "Risk Assessment",
      outputPlaceholder: { title: "Compliance Risk Summary", description: "Database-backed compliance gap summary.", type: "Compliance" }
    };
  }

  if (normalized.includes("health") || normalized.includes("high risk")) {
    const health = await getCentreHealth(scope);
    return {
      title: "Centre Health Report",
      summary: `${health.length} centre health profile(s) calculated from membership, compliance, procurement and funding readiness.`,
      answer: `Centre health was calculated for ${health.length} visible centre(s).`,
      bullets: health.slice(0, 8).map((item) => `${item.centreName}: ${item.score}% ${item.rating}, ${item.riskLevel} risk`),
      recommendations: health.flatMap((item) => item.recommendedActions.slice(0, 1)).slice(0, 4).map((action, index) => ({ id: `health-action-${index}`, title: action, description: "Recommended by the centre health rules engine.", actionLabel: "Open centre profile" })),
      confidenceLevel: 78,
      dataFreshnessDate: new Date().toISOString(),
      requiresHumanReview: true,
      warnings,
      sourceReferences: health.map((item) => ({ sourceType: "EcdCentre", sourceLabel: item.centreName, module: "Centre 360", relationship: "health score" })),
      sources: health.map((item) => source("EcdCentre", item.centreId, item.centreName, "Centre 360", "health score")),
      category: "Risk",
      responseType: "Risk Assessment",
      outputPlaceholder: { title: "Centre Health Report", description: "Reusable health score report placeholder.", type: "Report" }
    };
  }

  if (normalized.includes("procurement") || normalized.includes("order") || normalized.includes("budget")) {
    const recommendation = await getProcurementRecommendations(scope, {});
    return {
      title: "Procurement Recommendation",
      summary: recommendation.summary,
      answer: recommendation.summary,
      bullets: recommendation.items.map((item) => `${item.productName}: ${item.quantity} x ${item.packSize} = R${item.estimatedTotal.toLocaleString("en-ZA")}`),
      recommendations: [{ id: "review-order", title: "Review before submitting", description: "The centre must review and accept any recommendation before creating an order.", actionLabel: "Open procurement" }],
      confidenceLevel: 74,
      dataFreshnessDate: new Date().toISOString(),
      requiresHumanReview: true,
      warnings: [...warnings, ...recommendation.warnings],
      sourceReferences: recommendation.sources,
      sources: recommendation.sources.map((item) => source(item.sourceType, item.sourceId, item.sourceLabel, item.module, item.relationship)),
      category: "Procurement",
      responseType: "Recommendation",
      outputPlaceholder: { title: "Suggested Procurement Basket", description: "Budget-aware recommendation placeholder.", type: "Procurement" }
    };
  }

  if (normalized.includes("funding") || normalized.includes("proposal") || normalized.includes("motivation")) {
    const matches = await getFundingMatches(scope, {});
    return {
      title: normalized.includes("proposal") || normalized.includes("motivation") ? "Funding Proposal Draft Outline" : "Funding Match Summary",
      summary: matches.summary,
      answer: matches.summary,
      bullets: matches.matches.slice(0, 8).map((item) => `${item.centreName}: ${item.callTitle} (${item.matchScore}% match)`),
      recommendations: [{ id: "human-review", title: "Review eligibility", description: "Funding matches are recommendations only and do not guarantee approval.", actionLabel: "Open funding readiness" }],
      confidenceLevel: 72,
      dataFreshnessDate: new Date().toISOString(),
      requiresHumanReview: true,
      warnings: [...warnings, "Funding recommendations require human review and funder confirmation."],
      sourceReferences: matches.sources,
      sources: matches.sources.map((item) => source(item.sourceType, item.sourceId, item.sourceLabel, item.module, item.relationship)),
      category: "Funding",
      responseType: normalized.includes("proposal") ? "Proposal Draft" : "Recommendation",
      outputPlaceholder: { title: "Funding Match / Proposal Placeholder", description: "Rule-based funding readiness output.", type: "Proposal" }
    };
  }

  if (normalized.includes("supplier") || normalized.includes("delivery") || normalized.includes("stock")) {
    const suppliers = await prisma.supplier.findMany({ where: scope.isPlatformWide ? {} : { id: { in: scope.supplierIds } }, include: { performanceRecords: { orderBy: { calculatedAt: "desc" }, take: 1 }, supplierOrders: true, deliveries: true }, take: 8 });
    return {
      title: "Supplier Intelligence Summary",
      summary: `${suppliers.length} supplier profile(s) analysed from visible supplier records.`,
      answer: "Supplier performance was summarised from delivery, order and performance records.",
      bullets: suppliers.map((supplier) => `${supplier.companyName}: ${supplier.performanceRecords[0]?.averagePerformanceScore ?? 0}% score, ${supplier.deliveries.length} delivery record(s)`),
      recommendations: [{ id: "supplier-risk", title: "Review low performance suppliers", description: "Prioritise suppliers below 70% for follow-up.", actionLabel: "Open supplier reports" }],
      confidenceLevel: 76,
      dataFreshnessDate: new Date().toISOString(),
      requiresHumanReview: true,
      warnings,
      sourceReferences: suppliers.map((item) => ({ sourceType: "Supplier", sourceLabel: item.companyName, module: "Supplier Portal", relationship: "performance" })),
      sources: suppliers.map((item) => source("Supplier", item.id, item.companyName, "Supplier Portal", "performance")),
      category: "Supplier",
      responseType: "Summary"
    };
  }

  if (normalized.includes("partner") || normalized.includes("donor") || normalized.includes("impact")) {
    const projects = await prisma.impactProject.findMany({ where: { approvedForPartnerPortal: true, archivedAt: null }, include: { centre: true, commitments: true }, take: 8 });
    return {
      title: "Partner Impact Summary",
      summary: `${projects.length} approved partner-facing project(s) found.`,
      answer: "Partner-facing impact data was summarised from approved project records only.",
      bullets: projects.map((project) => `${project.title}: ${project.centre.centreName}, ${project.numberOfBeneficiaries ?? project.centre.numberOfChildren ?? 0} beneficiaries`),
      recommendations: [{ id: "impact-review", title: "Review partner-facing projects", description: "Use approved records only for partner recommendations.", actionLabel: "Open donor portal" }],
      confidenceLevel: 80,
      dataFreshnessDate: new Date().toISOString(),
      requiresHumanReview: true,
      warnings,
      sourceReferences: projects.map((item) => ({ sourceType: "ImpactProject", sourceLabel: item.title, module: "Donor & CSI", relationship: "approved partner data" })),
      sources: projects.map((item) => source("ImpactProject", item.id, item.title, "Donor & CSI", "approved partner data")),
      category: "Donor and CSI",
      responseType: "Summary"
    };
  }

  const search = await smartSearch(scope, { q: queryText, page: 1, pageSize: 8 });
  return {
    title: "Smart Search Results",
    summary: `${search.total} permitted record(s) matched your query.`,
    answer: `I found ${search.total} permitted record(s) matching your question. Results are filtered by your role and organisation ownership.`,
    bullets: search.results.map((item) => `${item.module}: ${item.title} (${item.type})`),
    recommendations: [{ id: "refine-search", title: "Refine search", description: "Ask about centres, compliance, procurement, funding, suppliers or partner impact.", actionLabel: "Ask follow-up" }],
    confidenceLevel: 68,
    dataFreshnessDate: new Date().toISOString(),
    requiresHumanReview: true,
    warnings,
    sourceReferences: search.results.map((item) => ({ sourceType: item.type, sourceLabel: item.title, module: item.module, relationship: "search result" })),
    sources: search.results.map((item) => source(item.type, item.id, item.title, item.module, "search result")),
    category: "Search",
    responseType: "Search Results",
    outputPlaceholder: { title: "Smart Search Results", description: "Role-aware search result set.", type: "Search" }
  };
}

export async function submitIntelligenceQuery(scope: IntelligenceScope, input: { queryText: string; queryCategory?: string; queryIntent?: string; metadata?: unknown }) {
  const generated = await buildDeterministicResponse(input.queryText, scope);
  const organisation = scope.centreIds[0] ? ["Centre", scope.centreIds[0]] : scope.supplierIds[0] ? ["Supplier", scope.supplierIds[0]] : scope.donorOrganisationIds[0] ? ["DonorOrganisation", scope.donorOrganisationIds[0]] : scope.fundingOrganisationIds[0] ? ["FundingOrganisation", scope.fundingOrganisationIds[0]] : ["Platform", undefined];

  const result = await prisma.$transaction(async (tx) => {
    const query = await tx.intelligenceQuery.create({
      data: {
        userId: scope.userId,
        roleId: scope.roleId,
        organisationType: organisation[0],
        organisationId: organisation[1],
        queryText: input.queryText,
        queryCategory: generated.category ?? input.queryCategory ?? "General",
        queryIntent: input.queryIntent,
        status: "COMPLETED",
        completedAt: new Date(),
        metadata: input.metadata === undefined ? undefined : JSON.parse(JSON.stringify(input.metadata))
      }
    });
    const response = await tx.intelligenceResponse.create({
      data: {
        queryId: query.id,
        responseType: generated.responseType ?? "Direct Answer",
        title: generated.title ?? "ECDLink Intelligence Response",
        summary: generated.summary,
        answerText: generated.answer,
        structuredData: {
          bullets: generated.bullets,
          recommendations: generated.recommendations,
          outputPlaceholder: generated.outputPlaceholder
        },
        confidenceLevel: generated.confidenceLevel ?? 70,
        dataFreshnessDate: new Date(generated.dataFreshnessDate ?? new Date()),
        generatedBy: "Rules Engine",
        requiresHumanReview: generated.requiresHumanReview ?? true,
        warnings: generated.warnings ?? [],
        sourceReferences: { create: (generated.sources ?? []).map((item) => ({ sourceType: item.sourceType, sourceId: item.sourceId, sourceLabel: item.sourceLabel, module: item.module, relationship: item.relationship })) }
      },
      include: { sourceReferences: true }
    });
    await tx.intelligenceQuery.update({ where: { id: query.id }, data: { responseId: response.id } });
    await tx.auditLog.create({ data: { actorUserId: scope.userId, action: "intelligence.query.completed", entityType: "IntelligenceQuery", entityId: query.id, metadata: { category: query.queryCategory, responseId: response.id } } });
    return { query: await tx.intelligenceQuery.findUnique({ where: { id: query.id }, include: { response: { include: { sourceReferences: true } } } }), response };
  });

  return { query: toPlain(result.query), response: responseDto(result.response) };
}

export async function getCentreHealth(scope: IntelligenceScope, input: { centreId?: string } = {}) {
  const centreWhere = scope.isPlatformWide ? (input.centreId ? { id: input.centreId } : {}) : { id: { in: scope.centreIds } };
  const centres = await prisma.ecdCentre.findMany({
    where: centreWhere,
    include: {
      memberships: { orderBy: { createdAt: "desc" }, take: 1 },
      complianceDocuments: true,
      procurementOrders: { include: { deliveries: true }, orderBy: { submittedAt: "desc" }, take: 3 },
      fundingProfiles: { orderBy: { updatedAt: "desc" }, take: 1 },
      impactProjects: { include: { reports: true }, take: 3 }
    },
    take: 50
  });
  return centres.map((centre) => {
    const membership = centre.memberships[0];
    const complianceBad = centre.complianceDocuments.filter((doc) => ["MISSING", "EXPIRED", "REJECTED"].includes(doc.status)).length;
    const complianceScore = centre.complianceDocuments.length ? Math.max(0, 100 - complianceBad * 12) : 40;
    const membershipScore = membership?.status === "ACTIVE" && membership.paymentStatus === "PAID" ? 100 : membership?.status === "OVERDUE" ? 30 : 65;
    const procurementScore = centre.procurementOrders.length ? 80 : 45;
    const deliveryPenalty = centre.procurementOrders.flatMap((order) => order.deliveries).some((delivery) => ["FAILED", "CANCELLED"].includes(delivery.status)) ? 15 : 0;
    const fundingScore = centre.fundingProfiles[0]?.readinessScore ?? 50;
    const profileMissing = [centre.npoNumber, centre.email, centre.phone, centre.physicalAddress, centre.principalName].filter(Boolean).length;
    const profileScore = profileMissing >= 4 ? 90 : 55;
    const score = Math.max(0, Math.min(100, Math.round((membershipScore * 0.2) + (complianceScore * 0.3) + ((procurementScore - deliveryPenalty) * 0.15) + (fundingScore * 0.25) + (profileScore * 0.1))));
    const rating = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Needs Attention" : "Critical";
    const riskLevel = score >= 85 ? "Low" : score >= 70 ? "Medium" : score >= 50 ? "High" : "Critical";
    const factors = [`Membership: ${membership?.status ?? "No record"}`, `Compliance score: ${complianceScore}%`, `Funding readiness: ${fundingScore}%`, `Procurement records: ${centre.procurementOrders.length}`];
    const recommendedActions = [
      complianceBad ? "Resolve missing, expired or rejected compliance documents." : "",
      membershipScore < 80 ? "Review membership renewal or outstanding payment." : "",
      fundingScore < 70 ? "Complete funding readiness checklist and supporting documents." : "",
      profileScore < 80 ? "Update missing centre profile information." : ""
    ].filter(Boolean);
    return { centreId: centre.id, centreName: centre.centreName, score, rating, riskLevel, contributingFactors: factors, recommendedActions, lastCalculatedAt: new Date().toISOString() };
  });
}

export async function getComplianceGaps(scope: IntelligenceScope, input: { centreId?: string } = {}) {
  const where = scope.isPlatformWide ? (input.centreId ? { centreId: input.centreId } : {}) : { centreId: { in: scope.centreIds } };
  const docs = await prisma.complianceDocument.findMany({ where: { ...where, status: { in: ["MISSING", "EXPIRED", "EXPIRING_SOON", "REJECTED"] } }, include: { centre: true, requirement: true }, orderBy: [{ status: "asc" }, { expiryDate: "asc" }], take: 100 });
  const items = docs.map((doc) => ({ id: doc.id, centreName: doc.centre.centreName, label: doc.requirement?.name ?? doc.documentType, status: doc.status.replaceAll("_", " "), expiryDate: doc.expiryDate?.toISOString() ?? null }));
  return {
    summary: `${items.length} compliance gap(s) found in the permitted data scope.`,
    riskLevel: items.some((item) => item.status === "EXPIRED" || item.status === "REJECTED") ? "High" : items.length ? "Medium" : "Low",
    items,
    recommendedActions: ["Prioritise expired and rejected documents.", "Send renewal reminders for documents expiring within 30 to 90 days.", "Confirm centre profile information before funder review."],
    sources: docs.map((doc) => ({ sourceType: "ComplianceDocument", sourceId: doc.id, sourceLabel: doc.requirement?.name ?? doc.documentType, module: "Compliance", relationship: doc.status }))
  };
}

export async function getProcurementRecommendations(scope: IntelligenceScope, input: { centreId?: string; budget?: number }) {
  const centre = await prisma.ecdCentre.findFirst({ where: scope.isPlatformWide ? (input.centreId ? { id: input.centreId } : {}) : { id: { in: scope.centreIds } }, include: { procurementOrders: { include: { items: true }, orderBy: { submittedAt: "desc" }, take: 3 } } });
  const budget = input.budget ?? 3000;
  const products = await prisma.product.findMany({ include: { supplierProducts: { include: { supplier: true }, take: 1 } }, orderBy: { name: "asc" }, take: 12 });
  const childCount = Math.max(centre?.numberOfChildren ?? 25, 1);
  let running = 0;
  const items = products.slice(0, 6).map((product, index) => {
    const supplierProduct = product.supplierProducts[0];
    const price = decimalNumber(supplierProduct?.unitPrice ?? 0);
    const quantity = Math.max(1, Math.min(8, Math.ceil(childCount / 35) + (index % 2)));
    const total = price * quantity;
    running += total;
    return { productId: product.id, productName: product.name, packSize: product.packSize ?? "Pack", supplierName: supplierProduct?.supplier.companyName ?? product.brand ?? "Supplier TBC", quantity, unitPrice: price, estimatedTotal: total, explanation: `Quantity based on ${childCount} children and common ECD ordering patterns.` };
  }).filter((item) => running <= budget * 1.2);
  const estimatedTotal = items.reduce((sum, item) => sum + item.estimatedTotal, 0);
  return {
    centreId: centre?.id,
    centreName: centre?.centreName ?? "Visible centre",
    selectedBudget: budget,
    items,
    estimatedTotal,
    remainingBudget: Math.max(0, budget - estimatedTotal),
    warnings: estimatedTotal > budget ? ["Recommendation exceeds budget and must be reduced before checkout."] : [],
    summary: `Suggested ${items.length} item(s) for a R${budget.toLocaleString("en-ZA")} budget. The centre must review before ordering.`,
    sources: [{ sourceType: "EcdCentre", sourceId: centre?.id ?? "scope", sourceLabel: centre?.centreName ?? "Scoped centre", module: "Procurement", relationship: "children count and history" }, ...items.map((item) => ({ sourceType: "Product", sourceId: item.productId, sourceLabel: item.productName, module: "Procurement", relationship: "catalogue price" }))]
  };
}

export async function getFundingMatches(scope: IntelligenceScope, input: { centreId?: string; projectId?: string }) {
  const centres = await prisma.ecdCentre.findMany({ where: scope.isPlatformWide ? (input.centreId ? { id: input.centreId } : {}) : { id: { in: scope.centreIds } }, include: { fundingProfiles: { orderBy: { updatedAt: "desc" }, take: 1 }, impactProjects: true }, take: 30 });
  const calls = await prisma.fundingCall.findMany({ where: scope.fundingOrganisationIds.length ? { fundingOrganisationId: { in: scope.fundingOrganisationIds } } : { status: { in: ["Open", "Published", "Active"] } }, include: { organisation: true }, take: 30 });
  const matches = centres.flatMap((centre) => calls.slice(0, 5).map((call) => {
    const readiness = centre.fundingProfiles[0]?.readinessScore ?? 50;
    const regionMatch = call.eligibleRegions.length === 0 || call.eligibleRegions.includes(centre.region ?? "") || call.eligibleRegions.includes(centre.province ?? "");
    const score = Math.min(95, Math.round(readiness * 0.55 + (regionMatch ? 25 : 5) + (call.requiredDocuments.length ? 10 : 15)));
    return { centreId: centre.id, centreName: centre.centreName, fundingCallId: call.id, callTitle: call.title, funderName: call.organisation.name, matchScore: score, closingDate: call.closesAt?.toISOString() ?? null, eligibilityWarnings: regionMatch ? [] : ["Region may not match the funding call eligibility."], missingRequirements: readiness < 75 ? ["Improve funding readiness score before submission."] : [], recommendedAction: "Review requirements and prepare application pack.", explanation: "Matched using region, readiness, required documents and call status." };
  })).sort((a, b) => b.matchScore - a.matchScore).slice(0, 20);
  return { summary: `${matches.length} funding match candidate(s) found. Matches are recommendations only, not approval guarantees.`, matches, sources: matches.map((item) => ({ sourceType: "FundingCall", sourceId: item.fundingCallId, sourceLabel: item.callTitle, module: "Funding", relationship: "match candidate" })) };
}

export async function smartSearch(scope: IntelligenceScope, input: { q?: string; page?: number; pageSize?: number; category?: string; status?: string; region?: string }) {
  const query = input.q?.trim().toLowerCase() ?? "";
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const results: Array<{ id: string; type: string; title: string; subtitle: string; module: string; score: number; route?: string }> = [];
  const contains = (values: Array<string | null | undefined>) => !query || values.join(" ").toLowerCase().includes(query);

  if (scope.isPlatformWide || scope.centreIds.length) {
    const centres = await prisma.ecdCentre.findMany({ where: scope.isPlatformWide ? {} : { id: { in: scope.centreIds } }, take: 80 });
    centres.filter((centre) => contains([centre.centreName, centre.principalName, centre.npoNumber, centre.region, centre.area])).forEach((centre) => results.push({ id: centre.id, type: "EcdCentre", title: centre.centreName, subtitle: centre.region ?? "Centre", module: "Centres", score: 90, route: `/dashboard/super-admin/centres/${centre.slug}` }));
  }

  const suppliers = await prisma.supplier.findMany({ where: scope.isPlatformWide ? {} : { id: { in: scope.supplierIds } }, take: 40 });
  suppliers.filter((supplier) => contains([supplier.companyName, supplier.contactPerson, supplier.email])).forEach((supplier) => results.push({ id: supplier.id, type: "Supplier", title: supplier.companyName, subtitle: supplier.status, module: "Supplier Portal", score: 75 }));

  const calls = await prisma.fundingCall.findMany({ where: scope.fundingOrganisationIds.length ? { fundingOrganisationId: { in: scope.fundingOrganisationIds } } : {}, include: { organisation: true }, take: 40 });
  calls.filter((call) => contains([call.title, call.type, call.organisation.name])).forEach((call) => results.push({ id: call.id, type: "FundingCall", title: call.title, subtitle: call.organisation.name, module: "Funding", score: 70 }));

  const projects = await prisma.impactProject.findMany({ where: { approvedForPartnerPortal: true, archivedAt: null }, include: { centre: true }, take: 40 });
  projects.filter((project) => contains([project.title, project.category, project.centre.centreName])).forEach((project) => results.push({ id: project.id, type: "ImpactProject", title: project.title, subtitle: project.centre.centreName, module: "Donor & CSI", score: 68 }));

  const start = (page - 1) * pageSize;
  return { total: results.length, page, pageSize, results: results.sort((a, b) => b.score - a.score).slice(start, start + pageSize) };
}

export async function createProposalDraft(scope: IntelligenceScope, input: { centreId?: string; projectId?: string; fundingCallId?: string; title?: string }) {
  const centre = await prisma.ecdCentre.findFirst({ where: scope.isPlatformWide ? { id: input.centreId } : { id: { in: scope.centreIds } }, include: { fundingProfiles: { take: 1, orderBy: { updatedAt: "desc" } }, impactProjects: { take: 1 } } });
  if (!centre) throw new Error("A permitted centre is required to create a proposal draft.");
  const draft = await prisma.intelligenceProposalDraft.create({ data: { centreId: centre.id, projectId: input.projectId ?? centre.impactProjects[0]?.id, fundingCallId: input.fundingCallId, title: input.title ?? `${centre.centreName} Funding Motivation Draft`, executiveSummary: `${centre.centreName} serves ${centre.numberOfChildren ?? 0} children and requires support to strengthen early childhood development outcomes.`, organisationBackground: `${centre.centreName} is an ECD centre in ${centre.region ?? "South Africa"}.`, problemStatement: "Township ECD centres need reliable resources, compliance readiness and sustainable programme support.", projectDescription: "This draft is generated from existing ECDLink records and must be reviewed before formal submission.", objectives: ["Improve child wellbeing", "Strengthen centre operations", "Support compliance and reporting"], expectedOutcomes: ["Improved readiness", "Documented beneficiary support"], implementationPlan: "Implementation plan placeholder based on centre operations.", monitoringAndEvaluation: "Track beneficiaries, photos, reports and completion evidence.", sustainability: "Strengthen local operating capacity and partner accountability.", risks: "Incomplete data may affect accuracy.", conclusion: "Human review is required before conversion.", generatedFromData: { centreId: centre.id, readinessScore: centre.fundingProfiles[0]?.readinessScore ?? null }, createdByUserId: scope.userId } });
  await createAuditLog({ actorUserId: scope.userId, action: "intelligence.proposal_draft.created", entityType: "IntelligenceProposalDraft", entityId: draft.id, after: draft });
  return toPlain(draft);
}

export async function createBudgetDraft(scope: IntelligenceScope, input: { centreId?: string; projectId?: string; title?: string; requestedAmount?: number }) {
  const centre = await prisma.ecdCentre.findFirst({ where: scope.isPlatformWide ? { id: input.centreId } : { id: { in: scope.centreIds } } });
  if (!centre) throw new Error("A permitted centre is required to create a budget draft.");
  const requested = input.requestedAmount ?? 25000;
  const categories = ["Nutrition", "Learning resources", "Compliance support", "Reporting"];
  const perItem = requested / categories.length;
  const draft = await prisma.intelligenceBudgetDraft.create({ data: { centreId: centre.id, projectId: input.projectId, title: input.title ?? `${centre.centreName} Budget Draft`, requestedAmount: money(requested), estimatedTotal: money(requested), assumptions: ["Budget is indicative.", "Human review required before conversion."], createdByUserId: scope.userId, items: { create: categories.map((category) => ({ category, description: `${category} allocation`, quantity: 1, unit: "allocation", estimatedUnitCost: money(perItem), estimatedTotal: money(perItem), justification: "Rule-based draft allocation from requested amount.", sourceType: "IntelligenceBudgetDraft" })) } }, include: { items: true } });
  await createAuditLog({ actorUserId: scope.userId, action: "intelligence.budget_draft.created", entityType: "IntelligenceBudgetDraft", entityId: draft.id, after: draft });
  return toPlain(draft);
}

export async function createIntelligenceReport(scope: IntelligenceScope, input: { reportType: string; title?: string; metadata?: unknown }) {
  const response = await buildDeterministicResponse(input.reportType, scope);
  const query = await submitIntelligenceQuery(scope, { queryText: input.title ?? `Generate ${input.reportType}`, queryCategory: "Reporting", queryIntent: input.reportType, metadata: input.metadata });
  if (query.query?.response?.id) {
    await prisma.intelligenceResponse.update({ where: { id: query.query.response.id }, data: { responseType: "Report", title: input.title ?? response.title ?? input.reportType } });
  }
  await createAuditLog({ actorUserId: scope.userId, action: "intelligence.report.generated", entityType: "IntelligenceResponse", entityId: query.query?.response?.id, metadata: { reportType: input.reportType, title: response.title } });
  return query;
}

export async function convertProposalDraft(scope: IntelligenceScope, draftId: string) {
  const draft = await prisma.intelligenceProposalDraft.findFirst({ where: scope.isPlatformWide ? { id: draftId } : { id: draftId, centreId: { in: scope.centreIds } } });
  if (!draft) throw new Error("Proposal draft was not found or is outside your permitted scope.");
  const updated = await prisma.intelligenceProposalDraft.update({ where: { id: draftId }, data: { status: "CONVERTED" } });
  await createAuditLog({ actorUserId: scope.userId, action: "intelligence.proposal_draft.converted", entityType: "IntelligenceProposalDraft", entityId: draftId, after: updated });
  return toPlain(updated);
}

export async function convertBudgetDraft(scope: IntelligenceScope, draftId: string) {
  const draft = await prisma.intelligenceBudgetDraft.findFirst({ where: scope.isPlatformWide ? { id: draftId } : { id: draftId, centreId: { in: scope.centreIds } } });
  if (!draft) throw new Error("Budget draft was not found or is outside your permitted scope.");
  const updated = await prisma.intelligenceBudgetDraft.update({ where: { id: draftId }, data: { status: "CONVERTED" } });
  await createAuditLog({ actorUserId: scope.userId, action: "intelligence.budget_draft.converted", entityType: "IntelligenceBudgetDraft", entityId: draftId, after: updated });
  return toPlain(updated);
}

export async function updateInsightStatus(scope: IntelligenceScope, insightId: string, status: string) {
  const where = roleWhere(scope);
  const existing = await prisma.intelligenceInsight.findFirst({ where: { id: insightId, ...where } as any });
  if (!existing) throw new Error("Insight was not found or is outside your permitted scope.");
  const data: any = { status };
  if (status === "ACKNOWLEDGED") data.acknowledgedAt = new Date();
  if (status === "RESOLVED" || status === "DISMISSED") data.resolvedAt = new Date();
  const updated = await prisma.intelligenceInsight.update({ where: { id: insightId }, data });
  await createAuditLog({ actorUserId: scope.userId, action: `intelligence.insight.${status.toLowerCase()}`, entityType: "IntelligenceInsight", entityId: insightId, after: updated });
  return toPlain(updated);
}

export async function updateRecommendationStatus(scope: IntelligenceScope, recommendationId: string, status: string) {
  const existing = await prisma.intelligenceRecommendation.findFirst({ where: { id: recommendationId, ...recommendationWhereForScope(scope) } as any });
  if (!existing) throw new Error("Recommendation was not found or is outside your permitted scope.");
  const data: any = { status };
  if (status === "ACCEPTED") data.acknowledgedAt = new Date();
  if (status === "COMPLETED") data.completedAt = new Date();
  const updated = await prisma.intelligenceRecommendation.update({ where: { id: recommendationId }, data });
  await createAuditLog({ actorUserId: scope.userId, action: `intelligence.recommendation.${status.toLowerCase()}`, entityType: "IntelligenceRecommendation", entityId: recommendationId, after: updated });
  return toPlain(updated);
}

export async function runIntelligenceScan(scope: IntelligenceScope) {
  if (!scope.isPlatformWide) throw new Error("Only Super Admin can run platform-wide intelligence scans.");
  const [expiredDocs, overdueMemberships, delayedDeliveries] = await Promise.all([
    prisma.complianceDocument.findMany({ where: { status: { in: ["EXPIRED", "EXPIRING_SOON", "REJECTED", "MISSING"] } }, include: { centre: true }, take: 50 }),
    prisma.membership.findMany({ where: { OR: [{ status: "OVERDUE" }, { paymentStatus: { in: ["OVERDUE", "NOT_PAID"] } }] }, include: { centre: true }, take: 50 }),
    prisma.delivery.findMany({ where: { status: { in: ["FAILED", "CANCELLED"] } }, include: { order: { include: { centre: true } }, supplier: true }, take: 50 })
  ]);
  const created: any[] = [];
  for (const doc of expiredDocs) {
    const id = `insight-compliance-${doc.id}`;
    created.push(await prisma.intelligenceInsight.upsert({ where: { id }, update: { status: "NEW", detectedAt: new Date() }, create: { id, insightType: "Compliance Risk", title: "Compliance document needs action", summary: `${doc.centre.centreName}: ${doc.documentType} is ${doc.status.replaceAll("_", " ").toLowerCase()}.`, severity: doc.status === "EXPIRED" ? "HIGH" : "MEDIUM", priority: doc.status === "EXPIRED" ? 1 : 2, targetRole: "SUPER_ADMIN", centreId: doc.centreId, relatedEntityType: "ComplianceDocument", relatedEntityId: doc.id, metadata: { value: doc.status } } }));
  }
  for (const membership of overdueMemberships) {
    const id = `insight-membership-${membership.id}`;
    created.push(await prisma.intelligenceInsight.upsert({ where: { id }, update: { status: "NEW", detectedAt: new Date() }, create: { id, insightType: "Membership Risk", title: "Membership payment risk", summary: `${membership.centre.centreName} has membership status ${membership.status}.`, severity: "HIGH", priority: 1, targetRole: "SUPER_ADMIN", centreId: membership.centreId, relatedEntityType: "Membership", relatedEntityId: membership.id, metadata: { value: membership.status } } }));
  }
  for (const delivery of delayedDeliveries) {
    const id = `insight-delivery-${delivery.id}`;
    created.push(await prisma.intelligenceInsight.upsert({ where: { id }, update: { status: "NEW", detectedAt: new Date() }, create: { id, insightType: "Delivery Risk", title: "Delivery requires follow-up", summary: `${delivery.order.centre.centreName} delivery is ${delivery.status}.`, severity: "MEDIUM", priority: 2, targetRole: "SUPER_ADMIN", centreId: delivery.order.centreId, supplierId: delivery.supplierId, relatedEntityType: "Delivery", relatedEntityId: delivery.id, metadata: { value: delivery.status } } }));
  }
  await createAuditLog({ actorUserId: scope.userId, action: "intelligence.scan.executed", entityType: "IntelligenceInsight", metadata: { createdOrUpdated: created.length } });
  return { createdOrUpdated: created.length };
}