import "server-only";

import { getFundingPartnerAccess } from "@/lib/funding/partner-access";
import { getFundingPartnerPortal } from "@/lib/repositories/funding-partner";

export async function getFundingPartnerDashboard() {
  const access = await getFundingPartnerAccess();
  if (!access) return null;
  return { access, data: await getFundingPartnerPortal(access) };
}
