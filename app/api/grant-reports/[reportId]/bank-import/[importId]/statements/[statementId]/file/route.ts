import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/responses";
import { requireReportAdmin } from "@/lib/api/report-auth";
import { getGrantBankStatementFile, GrantBankImportError } from "@/lib/services/grant-bank-imports";
import { StorageError } from "@/lib/storage/errors";

export async function GET(request: Request, { params }: { params: Promise<{ reportId: string; importId: string; statementId: string }> }) {
  const context = await requireReportAdmin();
  if ("error" in context) return context.error;
  const search = new URL(request.url).searchParams;
  const preview = search.get("preview") === "1";
  const download = search.get("download") === "1";
  if (preview === download) return apiError("Select either preview or download.", 400);
  try {
    const { reportId, importId, statementId } = await params;
    const access = await getGrantBankStatementFile({ reportId, importId, statementId, actorUserId: context.internalUser.id, mode: preview ? "preview" : "download" });
    return NextResponse.redirect(access.url, 302);
  } catch (error) {
    if (error instanceof GrantBankImportError || error instanceof StorageError) return apiError(error.message, error.status);
    return apiError("The bank statement could not be accessed.", 500);
  }
}
