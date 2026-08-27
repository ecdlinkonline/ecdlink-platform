import { requireIdentityAdmin } from "@/lib/api/identity-auth";

export async function requireReportAdmin() {
  return requireIdentityAdmin();
}
