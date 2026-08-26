import "server-only";

import { getInternalAuthContext } from "@/lib/auth/internal-context";
import type { FundingPartnerAccess } from "@/lib/funding/types";

export async function getFundingPartnerAccess(): Promise<FundingPartnerAccess | null> {
  const context = await getInternalAuthContext();
  if (context.reason !== null || context.internalUser.role !== "FUNDING_ORGANISATION") return null;
  const user = context.internalUser;
  const fundingOrganisationIds = user.fundingUsers.map((membership) => membership.fundingOrganisationId);
  if (!fundingOrganisationIds.length) return null;
  return { actorUserId: user.id, fundingOrganisationIds };
}
