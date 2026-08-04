import { requireFundingOrganisation } from "@/lib/api/funding-auth";
import { apiError, apiSuccess, statusFromError } from "@/lib/api/responses";
import { uploadFundingSupportingDocument } from "@/lib/services/funding-documents";

export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await requireFundingOrganisation();
  if ("error" in context) return context.error;
  try {
    const { documentId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return apiError("A file is required.", 422);
    return apiSuccess(await uploadFundingSupportingDocument({ documentId, actorUserId: context.internalUser.id, file }), 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("The funding document could not be uploaded.", 500);
  }
}
