import type { GrantBankTransactionReviewStatus, GrantBankTransactionType } from "@prisma/client";

export const grantBankTransactionCategories = [
  { value: "Funding / Subsidy Income", type: "INCOME" },
  { value: "Other Income", type: "INCOME" },
  { value: "Bank Charges", type: "BANK_CHARGE" },
  { value: "Salaries / Stipends", type: "EXPENSE" },
  { value: "Nutrition / Groceries", type: "EXPENSE" },
  { value: "Transport", type: "EXPENSE" },
  { value: "Educational / Learning Materials", type: "EXPENSE" },
  { value: "Maintenance / Repairs", type: "EXPENSE" },
  { value: "Utilities / Rent / Communications", type: "EXPENSE" },
  { value: "Cleaning Materials", type: "EXPENSE" },
  { value: "Other Operating Expenses", type: "EXPENSE" },
  { value: "Transfer", type: "TRANSFER" },
  { value: "Refund / Reversal", type: "REVERSAL_REFUND" },
  { value: "Other / Unclassified", type: "UNKNOWN" },
] as const satisfies ReadonlyArray<{ value: string; type: GrantBankTransactionType }>;

export type GrantBankTransactionCategory = (typeof grantBankTransactionCategories)[number]["value"];
export type GrantBankTransactionPresentationStatus = "UNCATEGORISED" | "SUGGESTED" | "NEEDS_REVIEW" | "CONFIRMED";

export type GrantBankCategorisationInput = {
  description: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
};

export type GrantBankCategorySuggestion = {
  category: GrantBankTransactionCategory;
  type: GrantBankTransactionType;
  confidence: number;
  requiresReview: boolean;
  providerName: string;
};

export const automaticCategorisationConfidenceThreshold = 0.9;

export interface GrantBankCategorisationProvider {
  readonly name: string;
  suggest(input: GrantBankCategorisationInput): Promise<GrantBankCategorySuggestion | null>;
}

type Rule = {
  pattern: RegExp;
  category: GrantBankTransactionCategory;
  confidence: number;
  directions?: Array<GrantBankCategorisationInput["direction"]>;
};

const rules: Rule[] = [
  { pattern: /\b(?:monthly account fee|service fees?|bank charges?|cash deposit fee|transaction fee|card replacement fee)\b/i, category: "Bank Charges", confidence: 0.99 },
  { pattern: /\b(?:salary|salaries|stipend|stipends|payroll|wages?)\b/i, category: "Salaries / Stipends", confidence: 0.96, directions: ["DEBIT"] },
  { pattern: /\b(?:grocery|groceries|supermarket|shoprite|boxer|food|nutrition|butchery|slaghuis)\b/i, category: "Nutrition / Groceries", confidence: 0.92, directions: ["DEBIT"] },
  { pattern: /\b(?:transport|taxi|bus|uber|fuel|petrol|diesel)\b/i, category: "Transport", confidence: 0.92, directions: ["DEBIT"] },
  { pattern: /\b(?:stationery|textbooks?|books?|toys?|learning materials?|educational materials?|school supplies?)\b/i, category: "Educational / Learning Materials", confidence: 0.91, directions: ["DEBIT"] },
  { pattern: /\b(?:maintenance|repairs?|hardware|plumbing|plumber|electrician)\b/i, category: "Maintenance / Repairs", confidence: 0.91, directions: ["DEBIT"] },
  { pattern: /\b(?:electricity|rent|telephone|airtime|data bundle|internet|water bill)\b/i, category: "Utilities / Rent / Communications", confidence: 0.9, directions: ["DEBIT"] },
  { pattern: /\b(?:cleaning materials?|detergent|disinfectant|bleach)\b/i, category: "Cleaning Materials", confidence: 0.92, directions: ["DEBIT"] },
  { pattern: /\b(?:grant|subsidy|funding received|department payment|dbe payment)\b/i, category: "Funding / Subsidy Income", confidence: 0.94, directions: ["CREDIT"] },
  { pattern: /\b(?:refund|reversal|reversed)\b/i, category: "Refund / Reversal", confidence: 0.9 },
];

export function categoryType(category: GrantBankTransactionCategory): GrantBankTransactionType {
  return grantBankTransactionCategories.find((candidate) => candidate.value === category)?.type ?? "UNKNOWN";
}

export function isGrantBankTransactionCategory(value: string | null): value is GrantBankTransactionCategory {
  return value !== null && grantBankTransactionCategories.some((category) => category.value === value);
}

export function shouldAutoConfirmGrantBankSuggestion(suggestion: GrantBankCategorySuggestion) {
  return suggestion.providerName === "deterministic-rules"
    && suggestion.confidence >= automaticCategorisationConfidenceThreshold
    && !suggestion.requiresReview
    && suggestion.type !== "UNKNOWN"
    && suggestion.category !== "Other / Unclassified";
}

export function shouldAutoConfirmPersistedGrantBankSuggestion(
  persisted: { suggestedType: GrantBankTransactionType | null; suggestedCategory: string | null; suggestedConfidence: { toNumber(): number } | number | null },
  generated: GrantBankCategorySuggestion,
) {
  const persistedConfidence = typeof persisted.suggestedConfidence === "number"
    ? persisted.suggestedConfidence
    : persisted.suggestedConfidence?.toNumber() ?? null;
  return shouldAutoConfirmGrantBankSuggestion(generated)
    && persisted.suggestedType === generated.type
    && persisted.suggestedCategory === generated.category
    && persistedConfidence === generated.confidence;
}

export function buildAutomaticGrantBankTransactionConfirmation(suggestion: GrantBankCategorySuggestion) {
  if (!shouldAutoConfirmGrantBankSuggestion(suggestion)) return {};
  return {
    confirmedType: suggestion.type,
    confirmedCategory: suggestion.category,
    reviewStatus: "REVIEWED" as const,
    reviewedByUserId: null,
    reviewedAt: null,
  };
}

export class DeterministicGrantBankCategorisationProvider implements GrantBankCategorisationProvider {
  readonly name = "deterministic-rules";

  async suggest(input: GrantBankCategorisationInput): Promise<GrantBankCategorySuggestion | null> {
    const match = rules.find((rule) => (!rule.directions || rule.directions.includes(input.direction)) && rule.pattern.test(input.description));
    if (!match) return null;
    return {
      category: match.category,
      type: categoryType(match.category),
      confidence: match.confidence,
      requiresReview: false,
      providerName: this.name,
    };
  }
}

export class GrantBankTransactionCategoriser {
  constructor(private readonly providers: GrantBankCategorisationProvider[] = [new DeterministicGrantBankCategorisationProvider()]) {}

  async suggest(input: GrantBankCategorisationInput): Promise<GrantBankCategorySuggestion> {
    for (const provider of this.providers) {
      const suggestion = await provider.suggest(input);
      if (suggestion) return suggestion;
    }
    return { category: "Other / Unclassified", type: "UNKNOWN", confidence: 0, requiresReview: true, providerName: "none" };
  }
}

export function categorisationPresentationStatus(input: {
  reviewStatus: GrantBankTransactionReviewStatus;
  suggestedCategory: string | null;
}): GrantBankTransactionPresentationStatus {
  if (input.reviewStatus === "REVIEWED") return "CONFIRMED";
  if (input.reviewStatus === "NEEDS_REVIEW") return "NEEDS_REVIEW";
  return input.suggestedCategory ? "SUGGESTED" : "UNCATEGORISED";
}

export function categorisationProgress(transactions: Array<{ reviewStatus: GrantBankTransactionReviewStatus; confirmedCategory: string | null }>) {
  const total = transactions.length;
  const reviewed = transactions.filter((transaction) => transaction.reviewStatus === "REVIEWED" && Boolean(transaction.confirmedCategory)).length;
  return {
    total,
    reviewed,
    remaining: total - reviewed,
    percentage: total === 0 ? 0 : Math.round((reviewed / total) * 100),
    readyToComplete: total > 0 && reviewed === total,
  };
}

export function buildGrantBankTransactionReviewUpdate(input: {
  category: GrantBankTransactionCategory;
  actorUserId: string;
  reviewedAt: Date;
}) {
  return {
    confirmedCategory: input.category,
    confirmedType: categoryType(input.category),
    reviewStatus: "REVIEWED" as const,
    reviewedByUserId: input.actorUserId,
    reviewedAt: input.reviewedAt,
  };
}

export const grantBankTransactionCategoriser = new GrantBankTransactionCategoriser();
