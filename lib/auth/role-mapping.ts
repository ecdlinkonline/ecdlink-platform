import type { UserRole as DatabaseUserRole } from "@prisma/client";
import type { UserRole } from "@/lib/auth/roles";

const applicationRoleByDatabaseRole: Record<DatabaseUserRole, UserRole | null> = {
  SUPER_ADMIN: "super_admin",
  ECDLINK_STAFF: "ecdlink_staff",
  ECD_CENTRE: "ecd_centre",
  SUPPLIER: "supplier",
  DONOR: "donor",
  FUNDING_ORGANISATION: "funding_partner",
  SYSTEM: null
};

export function applicationRoleForDatabaseRole(role: DatabaseUserRole) {
  return applicationRoleByDatabaseRole[role];
}

export const selfServiceRoles = ["ecd_centre", "supplier", "donor", "funding_partner"] as const;
export type SelfServiceRole = (typeof selfServiceRoles)[number];

export function isSelfServiceRole(role: UserRole): role is SelfServiceRole {
  return role === "ecd_centre" || role === "supplier" || role === "donor" || role === "funding_partner";
}

const databaseRoleBySelfServiceRole: Record<SelfServiceRole, DatabaseUserRole> = {
  ecd_centre: "ECD_CENTRE",
  supplier: "SUPPLIER",
  donor: "DONOR",
  funding_partner: "FUNDING_ORGANISATION"
};

export function databaseRoleForSelfServiceRole(role: SelfServiceRole) {
  return databaseRoleBySelfServiceRole[role];
}
