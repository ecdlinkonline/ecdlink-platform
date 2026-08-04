import { ZodError } from "zod";
import { requireFundingOrganisation } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { requestFundingDocumentResubmission, verifyFundingSupportingDocument } from "@/lib/services/funding-documents";
import { fundingDocumentActionSchema } from "@/lib/validators/funding";

export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await requireFundingOrganisation();
  if ("error" in context) return context.error;
  try {
    const { documentId } = await params;
    const input = fundingDocumentActionSchema.parse(await request.json());
    const actorUserId = context.internalUser.id;
    const result = input.action === "verify"
      ? await verifyFundingSupportingDocument({ documentId, actorUserId, reviewerComment: input.reviewerComment })
      : await requestFundingDocumentResubmission({
          documentId,
          actorUserId,
          rejectionReason: input.rejectionReason,
          reviewerComment: input.reviewerComment,
        });
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("The funding document action could not be completed.", 500);
  }
}
