import { NextRequest } from "next/server";
import { requireFundingUser } from "@/lib/api/funding-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { listFundingReadinessFromDb } from "@/lib/repositories/funding";
import { fundingFiltersSchema } from "@/lib/validators/funding";

type FundingReadinessFilters = Parameters<
  typeof listFundingReadinessFromDb
>[0];

export async function GET(request: NextRequest) {
  const context = await requireFundingUser();

  if ("error" in context) {
    return context.error;
  }

  if (context.authContext.role === "ecd_centre") {
    const centreIds = context.internalUser.centreUsers.map(
      (ownership) => ownership.centreId
    );

    const centreSlugs = context.internalUser.centreUsers.map(
      (ownership) => ownership.centre.slug
    );

    const records = await listFundingReadinessFromDb();

    return apiSuccess(
      records.filter(
        (record) =>
          centreIds.includes(record.centreId) ||
          centreSlugs.includes(record.centreId)
      )
    );
  }

  if (
    !["super_admin", "funding_partner"].includes(
      context.authContext.role ?? ""
    )
  ) {
    return apiError(
      "You do not have access to funding readiness records.",
      403
    );
  }

  const filters = fundingFiltersSchema.parse({
    query:
      request.nextUrl.searchParams.get("query") ?? undefined,
    region:
      request.nextUrl.searchParams.get("region") ?? undefined,
    status:
      request.nextUrl.searchParams.get("status") ?? undefined,
    funderType:
      request.nextUrl.searchParams.get("funderType") ?? undefined,
    readinessBand:
      request.nextUrl.searchParams.get("readinessBand") ?? undefined,
  }) as FundingReadinessFilters;

  return apiSuccess(
    await listFundingReadinessFromDb(filters)
  );
}