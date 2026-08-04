import { ZodError } from "zod";
import { requireFundingOrganisation } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { createFundingReviewerNote, listFundingReviewerNotes } from "@/lib/services/funding-communication";
import { fundingReviewerNoteSchema } from "@/lib/validators/funding-communication";
import { enforceRateLimit, requireTrustedOrigin } from "@/lib/api/security";

export async function GET(_request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const context = await requireFundingOrganisation(); if ("error" in context) return context.error;
  try { return apiSuccess(await listFundingReviewerNotes((await params).applicationId, context.internalUser.id)); }
  catch (error) { return apiError("Reviewer notes could not be loaded.", error instanceof Error ? statusFromError(error, 500) : 500); }
}
export async function POST(request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const context = await requireFundingOrganisation(); if ("error" in context) return context.error;
  const originError = requireTrustedOrigin(request); if (originError) return originError;
  const rateError = await enforceRateLimit("funding_notes", context.internalUser.id); if (rateError) return rateError;
  try { const input = fundingReviewerNoteSchema.parse(await request.json()); return apiSuccess(await createFundingReviewerNote((await params).applicationId, input.body, context.internalUser.id), 201); }
  catch (error) { if (error instanceof ZodError) return validationError(error); return apiError("Reviewer note could not be created.", error instanceof Error ? statusFromError(error, 500) : 500); }
}
