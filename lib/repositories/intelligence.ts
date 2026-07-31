import { prisma } from "@/lib/db/prisma";
import type { IntelligenceScope } from "@/lib/api/intelligence-auth";
import type { AiInsight, AiPrompt, MockAiResponse } from "@/lib/intelligence/types";

export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function decimalNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value ?? 0);
}

export function roleToDatabase(role: string) {
  if (role === "super_admin") return "SUPER_ADMIN";
  if (role === "ecdlink_staff") return "ECDLINK_STAFF";
  if (role === "supplier") return "SUPPLIER";
  if (role === "donor") return "DONOR";
  if (role === "funding_partner") return "FUNDING_ORGANISATION";
  return "ECD_CENTRE";
}

export function promptDto(template: any): AiPrompt {
  const mode = template.role === "SUPER_ADMIN" ? "command-centre" : template.role === "SUPPLIER" ? "supplier" : template.role === "DONOR" ? "donor" : template.role === "FUNDING_ORGANISATION" ? "funding-partner" : "ecd-centre";
  const role = template.role === "SUPER_ADMIN" ? "super_admin" : template.role === "SUPPLIER" ? "supplier" : template.role === "DONOR" ? "donor" : template.role === "FUNDING_ORGANISATION" ? "funding_partner" : "ecd_centre";
  return { id: template.id, label: template.title, prompt: template.promptText, roles: [role], mode };
}

export function responseDto(response: any): MockAiResponse {
  return {
    title: response.title,
    summary: response.summary ?? undefined,
    answer: response.answerText,
    bullets: response.structuredData?.bullets ?? [],
    recommendations: response.structuredData?.recommendations ?? [],
    confidenceLevel: response.confidenceLevel,
    dataFreshnessDate: response.dataFreshnessDate?.toISOString?.() ?? response.dataFreshnessDate,
    requiresHumanReview: response.requiresHumanReview,
    warnings: response.warnings ?? [],
    sourceReferences: (response.sourceReferences ?? []).map((source: any) => ({ sourceType: source.sourceType, sourceLabel: source.sourceLabel, module: source.module, relationship: source.relationship ?? undefined })),
    outputPlaceholder: response.structuredData?.outputPlaceholder
  };
}

export function insightDto(insight: any): AiInsight {
  const tone = insight.severity === "CRITICAL" || insight.severity === "HIGH" || insight.severity === "MEDIUM" ? "warning" : insight.severity === "LOW" ? "navy" : "green";
  return {
    id: insight.id,
    title: insight.title,
    value: insight.metadata?.value ?? (insight.severity ? insight.severity.replaceAll("_", " ") : "Info"),
    description: insight.summary,
    tone,
    severity: insight.severity?.replaceAll("_", " "),
    status: insight.status?.replaceAll("_", " ")
  };
}

export function insightWhereForScope(scope: IntelligenceScope) {
  if (scope.isPlatformWide) return {};
  if (scope.centreIds.length) return { centreId: { in: scope.centreIds } };
  if (scope.supplierIds.length) return { supplierId: { in: scope.supplierIds } };
  if (scope.donorOrganisationIds.length) return { donorOrganisationId: { in: scope.donorOrganisationIds } };
  if (scope.fundingOrganisationIds.length) return { fundingOrganisationId: { in: scope.fundingOrganisationIds } };
  return { id: "__none__" };
}

export function recommendationWhereForScope(scope: IntelligenceScope) {
  if (scope.isPlatformWide) return {};
  if (scope.centreIds.length) return { centreId: { in: scope.centreIds } };
  if (scope.supplierIds.length) return { supplierId: { in: scope.supplierIds } };
  if (scope.donorOrganisationIds.length) return { donorOrganisationId: { in: scope.donorOrganisationIds } };
  if (scope.fundingOrganisationIds.length) return { fundingOrganisationId: { in: scope.fundingOrganisationIds } };
  return { id: "__none__" };
}

export async function listPromptTemplates(scope: IntelligenceScope) {
  const templates = await prisma.intelligencePromptTemplate.findMany({
    where: { role: scope.databaseRole, active: true },
    orderBy: [{ displayOrder: "asc" }, { title: "asc" }]
  });
  return templates.map(promptDto);
}

export async function listQueries(scope: IntelligenceScope) {
  return toPlain(await prisma.intelligenceQuery.findMany({
    where: scope.isPlatformWide ? {} : { userId: scope.userId },
    include: { response: { include: { sourceReferences: true } } },
    orderBy: { createdAt: "desc" },
    take: 50
  }));
}

export async function getQuery(scope: IntelligenceScope, queryId: string) {
  const query = await prisma.intelligenceQuery.findUnique({ where: { id: queryId }, include: { response: { include: { sourceReferences: true } } } });
  if (!query) return null;
  if (!scope.isPlatformWide && query.userId !== scope.userId) return null;
  return toPlain(query);
}

export async function listInsights(scope: IntelligenceScope) {
  return (await prisma.intelligenceInsight.findMany({
    where: insightWhereForScope(scope),
    orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
    take: 50
  })).map(insightDto);
}

export async function listRecommendations(scope: IntelligenceScope) {
  return toPlain(await prisma.intelligenceRecommendation.findMany({
    where: recommendationWhereForScope(scope),
    orderBy: [{ priority: "asc" }, { generatedAt: "desc" }],
    take: 50
  }));
}

export async function findScopedInsight(scope: IntelligenceScope, insightId: string) {
  const insight = await prisma.intelligenceInsight.findUnique({ where: { id: insightId } });
  if (!insight) return null;
  if (scope.isPlatformWide) return insight;
  if (insight.centreId && scope.centreIds.includes(insight.centreId)) return insight;
  if (insight.supplierId && scope.supplierIds.includes(insight.supplierId)) return insight;
  if (insight.donorOrganisationId && scope.donorOrganisationIds.includes(insight.donorOrganisationId)) return insight;
  if (insight.fundingOrganisationId && scope.fundingOrganisationIds.includes(insight.fundingOrganisationId)) return insight;
  return null;
}

export async function findScopedRecommendation(scope: IntelligenceScope, recommendationId: string) {
  const recommendation = await prisma.intelligenceRecommendation.findUnique({ where: { id: recommendationId } });
  if (!recommendation) return null;
  if (scope.isPlatformWide) return recommendation;
  if (recommendation.userId === scope.userId) return recommendation;
  if (recommendation.centreId && scope.centreIds.includes(recommendation.centreId)) return recommendation;
  if (recommendation.supplierId && scope.supplierIds.includes(recommendation.supplierId)) return recommendation;
  if (recommendation.donorOrganisationId && scope.donorOrganisationIds.includes(recommendation.donorOrganisationId)) return recommendation;
  if (recommendation.fundingOrganisationId && scope.fundingOrganisationIds.includes(recommendation.fundingOrganisationId)) return recommendation;
  return null;
}
