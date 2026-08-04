import "server-only";

import { getAuthContext } from "@/lib/auth/session";
import { getInternalUserByClerkId } from "@/lib/repositories/users";
import type { FundingPartnerAccess } from "@/lib/funding/types";

export async function getFundingPartnerAccess(): Promise<FundingPartnerAccess | null> {
  const auth = await getAuthContext();
  if (!auth || auth.role !== "funding_partner") return null;
  const user = await getInternalUserByClerkId(auth.userId);
  if (!user || user.status !== "ACTIVE") return null;
  const fundingOrganisationIds = user.fundingUsers.map((membership) => membership.fundingOrganisationId);
  if (!fundingOrganisationIds.length) return null;
  return { actorUserId: user.id, fundingOrganisationIds };
}
