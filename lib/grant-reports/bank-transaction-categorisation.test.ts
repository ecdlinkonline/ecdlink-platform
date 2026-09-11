import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticCategorisationConfidenceThreshold,
  buildAutomaticGrantBankTransactionConfirmation,
  buildGrantBankTransactionReviewUpdate,
  categorisationPresentationStatus,
  categorisationProgress,
  DeterministicGrantBankCategorisationProvider,
  GrantBankTransactionCategoriser,
  shouldAutoConfirmGrantBankSuggestion,
  shouldAutoConfirmPersistedGrantBankSuggestion,
  type GrantBankCategorySuggestion,
} from "./bank-transaction-categorisation";

const provider = new DeterministicGrantBankCategorisationProvider();

test("deterministic rules suggest clear business-facing categories", async () => {
  const examples = [
    ["#Monthly Account Fee", "DEBIT", "Bank Charges"],
    ["Salary payment to practitioner", "DEBIT", "Salaries / Stipends"],
    ["POS Purchase Shoprite", "DEBIT", "Nutrition / Groceries"],
    ["Taxi transport service", "DEBIT", "Transport"],
    ["Learning materials and stationery", "DEBIT", "Educational / Learning Materials"],
    ["Plumbing repair", "DEBIT", "Maintenance / Repairs"],
  ] as const;
  for (const [description, direction, expectedCategory] of examples) {
    const suggestion = await provider.suggest({ description, direction, amount: 100 });
    assert.equal(suggestion?.category, expectedCategory);
    assert.equal(suggestion?.requiresReview, false);
  }
});

test("ambiguous transactions remain explicitly reviewable", async () => {
  const categoriser = new GrantBankTransactionCategoriser([provider]);
  const suggestion = await categoriser.suggest({ description: "Unrecognised reference", direction: "DEBIT", amount: 250 });
  assert.deepEqual(suggestion, { category: "Other / Unclassified", type: "UNKNOWN", confidence: 0, requiresReview: true, providerName: "none" });
});

test("manual confirmation overrides a suggestion without exposing extracted accounting fields", () => {
  const reviewedAt = new Date("2026-09-10T08:00:00.000Z");
  const update = buildGrantBankTransactionReviewUpdate({ category: "Transport", actorUserId: "user-1", reviewedAt });
  assert.deepEqual(update, { confirmedCategory: "Transport", confirmedType: "EXPENSE", reviewStatus: "REVIEWED", reviewedByUserId: "user-1", reviewedAt });
  for (const immutableField of ["transactionDate", "originalDescription", "originalAmount", "direction", "runningBalance", "transactionFingerprint"]) {
    assert.equal(immutableField in update, false);
  }
});

test("presentation states map existing persisted fields to the controlled review workflow", () => {
  assert.equal(categorisationPresentationStatus({ reviewStatus: "UNREVIEWED", suggestedCategory: null }), "UNCATEGORISED");
  assert.equal(categorisationPresentationStatus({ reviewStatus: "UNREVIEWED", suggestedCategory: "Bank Charges" }), "SUGGESTED");
  assert.equal(categorisationPresentationStatus({ reviewStatus: "NEEDS_REVIEW", suggestedCategory: "Other / Unclassified" }), "NEEDS_REVIEW");
  assert.equal(categorisationPresentationStatus({ reviewStatus: "REVIEWED", suggestedCategory: null }), "CONFIRMED");
});

test("completion requires every transaction to be explicitly reviewed, including Other / Unclassified", () => {
  const incomplete = categorisationProgress([
    { reviewStatus: "REVIEWED", confirmedCategory: "Bank Charges" },
    { reviewStatus: "NEEDS_REVIEW", confirmedCategory: null },
  ]);
  assert.deepEqual(incomplete, { total: 2, reviewed: 1, remaining: 1, percentage: 50, readyToComplete: false });
  const complete = categorisationProgress([
    { reviewStatus: "REVIEWED", confirmedCategory: "Bank Charges" },
    { reviewStatus: "REVIEWED", confirmedCategory: "Other / Unclassified" },
  ]);
  assert.deepEqual(complete, { total: 2, reviewed: 2, remaining: 0, percentage: 100, readyToComplete: true });
});

test("duplicate-looking transactions remain independent review rows", () => {
  const duplicateLooking = [
    { id: "transaction-1", reviewStatus: "REVIEWED" as const, confirmedCategory: "Salaries / Stipends" },
    { id: "transaction-2", reviewStatus: "UNREVIEWED" as const, confirmedCategory: null },
  ];
  assert.equal(new Set(duplicateLooking.map((transaction) => transaction.id)).size, 2);
  assert.deepEqual(categorisationProgress(duplicateLooking), { total: 2, reviewed: 1, remaining: 1, percentage: 50, readyToComplete: false });
});

test("categorisation never changes inconsistent source amounts or directions to force reconciliation", async () => {
  const sourceRows = [
    { description: "POS Purchase", direction: "DEBIT" as const, amount: 10014.5 },
    { description: "#Service Fees", direction: "DEBIT" as const, amount: 34.68 },
  ];
  const snapshot = structuredClone(sourceRows);
  await Promise.all(sourceRows.map((row) => provider.suggest(row)));
  assert.deepEqual(sourceRows, snapshot);
});

function suggestion(overrides: Partial<GrantBankCategorySuggestion> = {}): GrantBankCategorySuggestion {
  return {
    category: "Bank Charges",
    type: "BANK_CHARGE",
    confidence: automaticCategorisationConfidenceThreshold,
    requiresReview: false,
    providerName: "deterministic-rules",
    ...overrides,
  };
}

test("deterministic suggestions at or above 90 percent auto-confirm as machine reviews", () => {
  for (const confidence of [0.9, 0.96]) {
    const candidate = suggestion({ confidence });
    assert.equal(shouldAutoConfirmGrantBankSuggestion(candidate), true);
    assert.deepEqual(buildAutomaticGrantBankTransactionConfirmation(candidate), {
      confirmedType: "BANK_CHARGE",
      confirmedCategory: "Bank Charges",
      reviewStatus: "REVIEWED",
      reviewedByUserId: null,
      reviewedAt: null,
    });
  }
});

test("low-confidence, unknown and Other suggestions always require human review", () => {
  assert.equal(shouldAutoConfirmGrantBankSuggestion(suggestion({ confidence: 0.89 })), false);
  assert.equal(shouldAutoConfirmGrantBankSuggestion(suggestion({ category: "Other / Unclassified", type: "UNKNOWN", confidence: 0.99 })), false);
  assert.equal(shouldAutoConfirmGrantBankSuggestion(suggestion({ type: "UNKNOWN", confidence: 0.99 })), false);
  assert.deepEqual(buildAutomaticGrantBankTransactionConfirmation(suggestion({ confidence: 0.89 })), {});
});

test("automatically confirmed rows count toward progress without claiming a human reviewer", () => {
  const automatic = buildAutomaticGrantBankTransactionConfirmation(suggestion());
  assert.deepEqual(categorisationProgress([
    { reviewStatus: automatic.reviewStatus ?? "UNREVIEWED", confirmedCategory: automatic.confirmedCategory ?? null },
    { reviewStatus: "NEEDS_REVIEW", confirmedCategory: null },
  ]), { total: 2, reviewed: 1, remaining: 1, percentage: 50, readyToComplete: false });
  assert.equal(automatic.reviewedByUserId, null);
  assert.equal(automatic.reviewedAt, null);
});

test("an existing unreviewed deterministic suggestion auto-confirms only when it still matches exactly", () => {
  const candidate = suggestion({ confidence: 0.96, category: "Salaries / Stipends", type: "EXPENSE" });
  const persisted = { suggestedType: "EXPENSE" as const, suggestedCategory: "Salaries / Stipends", suggestedConfidence: 0.96 };
  assert.equal(shouldAutoConfirmPersistedGrantBankSuggestion(persisted, candidate), true);
  assert.equal(shouldAutoConfirmPersistedGrantBankSuggestion({ ...persisted, suggestedCategory: "Transport" }, candidate), false);
  assert.equal(shouldAutoConfirmPersistedGrantBankSuggestion({ ...persisted, suggestedConfidence: 0.89 }, candidate), false);
});
