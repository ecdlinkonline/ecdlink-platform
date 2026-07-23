import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireMembershipAdmin, requireMembershipApiUser } from "@/lib/api/membership-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { getMembershipRecordByCentreId, listMembershipRecords } from "@/lib/repositories/memberships";
import { createMembership } from "@/lib/services/memberships";
import { createMembershipSchema, membershipFiltersSchema } from "@/lib/validators/memberships";

export async function GET(request: NextRequest) {
  const context = await requireMembershipApiUser();
  if ("error" in context) return context.error;

  try {
    if (context.authContext.role === "ecd_centre") {
      if (!context.centreId) return apiError("No ECD centre is linked to this user.", 403);
      return apiSuccess(await getMembershipRecordByCentreId(context.centreId));
    }

    const searchParams = request.nextUrl.searchParams;
    const filters = membershipFiltersSchema.parse({
      query: searchParams.get("query") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      paymentStatus: searchParams.get("paymentStatus") ?? undefined,
      region: searchParams.get("region") ?? undefined,
      year: searchParams.get("year") ?? undefined
    });
    return apiSuccess(await listMembershipRecords(filters));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("Membership records could not be loaded.", 500);
  }
}

export async function POST(request: NextRequest) {
  const context = await requireMembershipAdmin();
  if ("error" in context) return context.error;

  try {
    const input = createMembershipSchema.parse(await request.json());
    return apiSuccess(await createMembership(input, context.actorUserId), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Membership could not be created.", 500);
  }
}
