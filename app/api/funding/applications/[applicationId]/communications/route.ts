import { ZodError } from "zod";
import { requireFundingOrganisation } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { createManualFundingCommunication, listFundingCommunications } from "@/lib/services/funding-communication";
import { fundingManualCommunicationSchema } from "@/lib/validators/funding-communication";

export async function GET(_request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const context = await requireFundingOrganisation(); if ("error" in context) return context.error;
  try { return apiSuccess(await listFundingCommunications((await params).applicationId, context.internalUser.id)); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Communication history could not be loaded.", error instanceof Error ? statusFromError(error) : 500); }
}
export async function POST(request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const context = await requireFundingOrganisation(); if ("error" in context) return context.error;
  try { const input = fundingManualCommunicationSchema.parse(await request.json()); return apiSuccess(await createManualFundingCommunication((await params).applicationId, input, context.internalUser.id), 201); }
  catch (error) { if (error instanceof ZodError) return validationError(error); return apiError(error instanceof Error ? error.message : "Communication could not be created.", error instanceof Error ? statusFromError(error) : 500); }
}
