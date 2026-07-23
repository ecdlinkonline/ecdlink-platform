import { ZodError } from "zod";
import { resolveComplianceCentre } from "@/lib/api/compliance-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { replaceComplianceDocument } from "@/lib/services/compliance";
import { complianceDocumentUploadSchema } from "@/lib/validators/compliance";

export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await resolveComplianceCentre();
  if ("error" in context) return context.error;
  const { documentId } = await params;
  const existing = await prisma.complianceDocument.findUnique({ where: { id: documentId } });
  if (!existing) return apiError("Document not found.", 404);
const linkedCentreIds = context.internalUser.centreUsers.map(
  (centreUser) => centreUser.centreId
);

if (
  linkedCentreIds.length > 0 &&
  !linkedCentreIds.includes(existing.centreId)
) {
  return apiError(
    "You can only replace your linked centre documents.",
    403
  );
}
  try {
    const input = complianceDocumentUploadSchema.parse(await request.json());
    return apiSuccess(await replaceComplianceDocument(documentId, input, context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Document could not be replaced.", 500);
  }
}
