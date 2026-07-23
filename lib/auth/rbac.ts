export const platformRoles = {
  SUPER_ADMIN: {
    name: "Super Admin",
    permissions: ["platform:*"]
  },
  ECD_CENTRE: {
    name: "ECD Centre",
    permissions: ["centre:read", "centre:update", "membership:read", "compliance:manage", "funding:manage", "procurement:manage"]
  },
  SUPPLIER: {
    name: "Supplier",
    permissions: ["supplier:read", "supplier:update", "supplier:orders:read", "supplier:deliveries:manage"]
  },
  DONOR: {
    name: "Donor / CSI Partner",
    permissions: ["donor:read", "donor:projects:read", "donor:messages:manage"]
  },
  FUNDING_ORGANISATION: {
    name: "Funding Organisation",
    permissions: ["funding:read", "funding:calls:manage", "funding:applications:assess"]
  },
  SYSTEM: {
    name: "System",
    permissions: ["system:*", "platform:*"]
  }
} as const;

export const centreRolePermissions = {
  PRINCIPAL: ["centre:read", "centre:update", "membership:read", "compliance:manage", "funding:manage", "procurement:manage", "messages:manage"],
  OWNER: ["centre:read", "centre:update", "membership:read", "compliance:manage", "funding:manage", "procurement:manage", "messages:manage"],
  ADMINISTRATOR: ["centre:read", "centre:update", "membership:read", "compliance:manage", "funding:manage", "procurement:manage"],
  PRACTITIONER: ["centre:read", "compliance:read", "funding:read", "procurement:read"],
  FINANCE: ["centre:read", "membership:read", "procurement:manage", "invoices:read"],
  VOLUNTEER: ["centre:read", "messages:read"],
  READ_ONLY: ["centre:read", "membership:read", "compliance:read", "funding:read", "procurement:read"]
} as const;

export type DatabaseUserRole = keyof typeof platformRoles;
export type CentreOwnershipRole = keyof typeof centreRolePermissions;

export function hasPermission(permissions: string[], permission: string) {
  return permissions.includes(permission) || permissions.includes("platform:*") || permissions.includes("system:*");
}

export function permissionsForPlatformRole(role: DatabaseUserRole) {
  return [...platformRoles[role].permissions];
}

export function permissionsForCentreRole(role: CentreOwnershipRole, extra: string[] = []) {
  return Array.from(new Set([...centreRolePermissions[role], ...extra]));
}
