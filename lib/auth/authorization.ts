import type { UserRole as DatabaseUserRole, UserStatus } from "@prisma/client";
import { applicationRoleForDatabaseRole } from "@/lib/auth/role-mapping";
import type { UserRole } from "@/lib/auth/roles";

export type AuthoritativeUser = {
  role: DatabaseUserRole;
  status: UserStatus;
};

export function authoritativeApplicationRole(user: AuthoritativeUser | null) {
  return user?.status === "ACTIVE" ? applicationRoleForDatabaseRole(user.role) : null;
}

export function hasAuthoritativeRole(user: AuthoritativeUser | null, ...roles: UserRole[]) {
  const role = authoritativeApplicationRole(user);
  return role !== null && roles.includes(role);
}
