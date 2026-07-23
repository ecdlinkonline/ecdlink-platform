import { ZodError } from "zod";
import { resolveComplianceCentre } from "@/lib/api/compliance-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { complianceDocumentInclude, mapComplianceDocument } from "@/lib/repositories/compliance";
import { uploadComplianceDocumentMetadata } from "@/lib/services/compliance";
import { complianceDocumentUploadSchema } from "@/lib/validators/compliance";

export async function GET() {
  const context = await resolveComplianceCentre();
  if ("error" in context) return context.error;
 const linkedCentreIds = context.internalUser.centreUsers.map(
  (centreUser) => centreUser.centreId
);

const documents = await prisma.complianceDocument.findMany({
  where:
    linkedCentreIds.length > 0
      ? {
          centreId: {
            in: linkedCentreIds,
          },
        }
      : undefined,

  include: complianceDocumentInclude,
  orderBy: { updatedAt: "desc" },
});
  return apiSuccess(documents.map(mapComplianceDocument));
}

export async function POST(request: Request) {
  const context = await resolveComplianceCentre();

  if ("error" in context) {
    return context.error;
  }

  const centreId = context.internalUser.centreUsers[0]?.centreId;

  if (!centreId) {
    return apiError(
      "Centre uploads must be submitted by a linked ECD Centre user.",
      403
    );
  }

  try {
    const input = complianceDocumentUploadSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await uploadComplianceDocumentMetadata(
        centreId,
        input,
        context.internalUser.id
      ),
      201
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error);
    }

    if (error instanceof Error) {
      return apiError(
        error.message,
        statusFromError(error)
      );
    }

    return apiError(
      "Document metadata could not be uploaded.",
      500
    );
  }
}