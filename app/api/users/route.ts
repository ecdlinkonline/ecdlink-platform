import { NextRequest } from "next/server";
import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { apiSuccess } from "@/lib/api/responses";
import { listUsers } from "@/lib/repositories/users";

export async function GET(request: NextRequest) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  const query = request.nextUrl.searchParams.get("query")?.toLowerCase();
  const role = request.nextUrl.searchParams.get("role");
  const status = request.nextUrl.searchParams.get("status");
  const users = await listUsers();

  return apiSuccess(users.filter((user) => {
    const searchable = [user.email, user.firstName, user.lastName, user.role, user.status].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) && (!role || role === "All" || user.role === role) && (!status || status === "All" || user.status === status);
  }));
}
