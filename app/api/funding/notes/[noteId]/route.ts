import { ZodError } from "zod";
import { requireFundingOrganisation } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { deleteFundingReviewerNote, updateFundingReviewerNote } from "@/lib/services/funding-communication";
import { fundingReviewerNoteSchema } from "@/lib/validators/funding-communication";

export async function PATCH(request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const context = await requireFundingOrganisation(); if ("error" in context) return context.error;
  try { const input = fundingReviewerNoteSchema.parse(await request.json()); return apiSuccess(await updateFundingReviewerNote((await params).noteId, input.body, context.internalUser.id)); }
  catch (error) { if (error instanceof ZodError) return validationError(error); return apiError(error instanceof Error ? error.message : "Reviewer note could not be updated.", error instanceof Error ? statusFromError(error) : 500); }
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const context = await requireFundingOrganisation(); if ("error" in context) return context.error;
  try { return apiSuccess(await deleteFundingReviewerNote((await params).noteId, context.internalUser.id)); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Reviewer note could not be deleted.", error instanceof Error ? statusFromError(error) : 500); }
}
