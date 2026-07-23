import type { UserRole } from "@/lib/auth/roles";
import { requireIntelligenceAccess } from "@/lib/api/intelligence-auth";
import { listPromptTemplates } from "@/lib/repositories/intelligence";
import { buildDeterministicResponse, getRoleInsightsFromDb } from "@/lib/services/intelligence";

export async function getPlatformInsights() {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return [];
  return getRoleInsightsFromDb(context.scope);
}

export async function getRoleInsights(_role: UserRole) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return [];
  return getRoleInsightsFromDb(context.scope);
}

export async function getIntelligencePrompts() {
  const context = await requireIntelligenceAccess();
  if ("error" in context) return [];
  return listPromptTemplates(context.scope);
}

export async function getMockAiResponse(prompt: string, _role: string) {
  const context = await requireIntelligenceAccess();
  if ("error" in context) {
    return {
      answer: "ECDLink Intelligence requires a configured database and authenticated platform user.",
      bullets: ["Database-backed Intelligence is unavailable in the current environment."],
      recommendations: [{ id: "configure-database", title: "Configure database", description: "Run the database migration and seed before using Intelligence.", actionLabel: "Review setup" }],
      requiresHumanReview: true,
      warnings: ["No database context was available."]
    };
  }
  return buildDeterministicResponse(prompt, context.scope);
}
