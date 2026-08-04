import { NextResponse } from "next/server";
import { requireFundingOrganisation } from "@/lib/api/funding-auth";
import { apiError, statusFromError } from "@/lib/api/responses";
import { getFundingDocumentDownloadAccess, getFundingDocumentPreviewAccess, isDownloadOnlyStorageError } from "@/lib/services/funding-documents";

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await requireFundingOrganisation();
  if ("error" in context) return context.error;
  try {
    const { documentId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const preview = searchParams.get("preview") === "1";
    const download = searchParams.get("download") === "1";
    if (preview === download) return apiError("Select either preview or download.", 400);
    const input = { documentId, actorUserId: context.internalUser.id };
    const access = preview
      ? await getFundingDocumentPreviewAccess(input)
      : await getFundingDocumentDownloadAccess(input);
    return NextResponse.redirect(access.url, 302);
  } catch (error) {
    if (isDownloadOnlyStorageError(error)) return apiError("This file type is download-only.", 422, { downloadOnly: true });
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("The funding document file could not be accessed.", 500);
  }
}
