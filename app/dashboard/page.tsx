import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { getDashboardPath } from "@/lib/auth/roles";

export default async function DashboardRouterPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/auth/sign-in");
  }

  if (!authContext.role) {
    redirect("/auth/select-role");
  }

  redirect(getDashboardPath(authContext.role));
}
