import { NextResponse } from "next/server";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { apiError, statusFromError } from "@/lib/api/responses";
import { getGrantAwardAgreementDownload, getGrantAwardAgreementPreview } from "@/lib/services/grant-award-agreements";

export async function GET(request: Request, { params }: { params: Promise<{ awardId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  try {
    const { awardId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const preview = searchParams.get("preview") === "1";
    const download = searchParams.get("download") === "1";
    if (preview === download) return apiError("Select either preview or download.", 400);
    const access = preview
      ? await getGrantAwardAgreementPreview({ awardId, actorUserId: context.internalUser.id })
      : await getGrantAwardAgreementDownload({ awardId, actorUserId: context.internalUser.id });
    return NextResponse.redirect(access.url, 302);
  } catch (error) {
    return apiError("The signed agreement could not be accessed.", error instanceof Error ? statusFromError(error, 500) : 500);
  }
}
