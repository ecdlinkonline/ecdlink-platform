import { ZodError } from "zod";
import { requireComplianceAdmin } from "@/lib/api/compliance-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { requestComplianceResubmission } from "@/lib/services/compliance";
import { complianceResubmissionSchema } from "@/lib/validators/compliance";

export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await requireComplianceAdmin();
  if ("error" in context) return context.error;
  try {
    const { documentId } = await params;
    const input = complianceResubmissionSchema.parse(await request.json());
    return apiSuccess(await requestComplianceResubmission(documentId, input.reason, context.internalUser.id));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Resubmission could not be requested.", 500);
  }
}
