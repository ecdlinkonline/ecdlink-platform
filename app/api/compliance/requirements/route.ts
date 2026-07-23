import { ZodError } from "zod";
import { requireComplianceAdmin, requireComplianceUser } from "@/lib/api/compliance-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { listComplianceRequirementsFromDb } from "@/lib/repositories/compliance";
import { createOrUpdateComplianceRequirement } from "@/lib/services/compliance";
import { complianceRequirementSchema } from "@/lib/validators/compliance";

export async function GET() {
  const context = await requireComplianceUser();
  if ("error" in context) return context.error;
  return apiSuccess(await listComplianceRequirementsFromDb());
}

export async function POST(request: Request) {
  const context = await requireComplianceAdmin();
  if ("error" in context) return context.error;
  try {
    const input = complianceRequirementSchema.parse(await request.json());
    return apiSuccess(await createOrUpdateComplianceRequirement(input, context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Requirement could not be saved.", 500);
  }
}
