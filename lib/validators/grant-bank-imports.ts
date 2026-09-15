import { z } from "zod";
import { grantBankTransactionCategories } from "@/lib/grant-reports/bank-transaction-categorisation";

const optionalDate = z.union([z.literal(""), z.string().date()]).transform((value) => value || null);
const optionalMoney = z.union([z.literal(""), z.string().regex(/^-?\d{1,12}(?:\.\d{1,2})?$/, "Enter a valid amount.")]).transform((value) => value || null);
const optionalText = (maximum: number) => z.union([z.literal(""), z.string().trim().max(maximum)]).transform((value) => value || null);

const grantBankStatementMetadataFields = z.object({
  statementMonth: optionalDate,
  periodStart: optionalDate,
  periodEnd: optionalDate,
  statementDate: optionalDate,
  bankName: optionalText(120),
  accountHolderName: optionalText(160),
  maskedAccountReference: optionalText(80).refine((value) => !value || (value.match(/\d/g)?.length ?? 0) <= 4, "Enter only a masked account reference with no more than four visible digits."),
  openingBalance: optionalMoney,
  closingBalance: optionalMoney,
  currency: z.union([z.literal(""), z.string().trim().regex(/^[A-Z]{3}$/, "Use a three-letter currency code.")]).transform((value) => value || null),
});

function validatePeriod(value: { periodStart: string | null; periodEnd: string | null }, context: z.RefinementCtx) {
  if (value.periodStart && value.periodEnd && value.periodEnd < value.periodStart) {
    context.addIssue({ code: "custom", path: ["periodEnd"], message: "The period end cannot be before the period start." });
  }
}

export const grantBankStatementMetadataSchema = grantBankStatementMetadataFields.superRefine(validatePeriod);

export const uploadGrantBankStatementSchema = grantBankStatementMetadataFields.extend({
  replaceStatementId: z.union([z.literal(""), z.string().cuid()]).optional().transform((value) => value || null),
}).superRefine(validatePeriod);

export type GrantBankStatementMetadataInput = z.infer<typeof grantBankStatementMetadataSchema>;
export type UploadGrantBankStatementInput = z.infer<typeof uploadGrantBankStatementSchema>;

const grantBankTransactionCategoryValues = grantBankTransactionCategories.map((category) => category.value) as [
  (typeof grantBankTransactionCategories)[number]["value"],
  ...(typeof grantBankTransactionCategories)[number]["value"][],
];

export const grantBankCategorisationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suggest") }),
  z.object({
    action: z.literal("confirm"),
    transactionId: z.string().cuid(),
    category: z.enum(grantBankTransactionCategoryValues),
  }),
  z.object({ action: z.literal("complete") }),
]);

export type GrantBankCategorisationActionInput = z.infer<typeof grantBankCategorisationActionSchema>;

export const grantBankPostingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("post") }).strict(),
  z.object({ action: z.literal("return_to_categorisation") }).strict(),
]);
