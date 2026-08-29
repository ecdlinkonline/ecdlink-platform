import { NextResponse } from "next/server";
import { apiError, statusFromError } from "@/lib/api/responses";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { getGrantReportDocumentDownload, getGrantReportDocumentPreview } from "@/lib/services/grant-report-documents";

export async function GET(request: Request, { params }: { params: Promise<{ reportId: string; documentId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  try {
    const { reportId, documentId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const preview = searchParams.get("preview") === "1";
    const download = searchParams.get("download") === "1";
    if (preview === download) return apiError("Select either preview or download.", 400);
    const access = preview
      ? await getGrantReportDocumentPreview({ reportId, documentId, actorUserId: context.internalUser.id })
      : await getGrantReportDocumentDownload({ reportId, documentId, actorUserId: context.internalUser.id });
    return NextResponse.redirect(access.url, 302);
  } catch (error) {
    return apiError("The report document could not be accessed.", error instanceof Error ? statusFromError(error, 500) : 500);
  }
}
