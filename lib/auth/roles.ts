import {
  Building2,
  HandHeart,
  Landmark,
  ShieldCheck,
  Store,
  type LucideIcon
} from "lucide-react";

export type UserRole = "super_admin" | "ecd_centre" | "supplier" | "donor" | "funding_partner";

export type RoleOption = {
  id: UserRole;
  title: string;
  shortTitle: string;
  description: string;
  dashboardPath: string;
  icon: LucideIcon;
};

export const roleOptions: RoleOption[] = [
  {
    id: "super_admin",
    title: "Super Admin",
    shortTitle: "Admin",
    description: "Operate the full ECDLink network across centres, suppliers, funding and reporting.",
    dashboardPath: "/dashboard/super-admin",
    icon: ShieldCheck
  },
  {
    id: "ecd_centre",
    title: "ECD Centre",
    shortTitle: "Centre",
    description: "Manage membership, documents, procurement, funding, events and messages.",
    dashboardPath: "/dashboard/ecd-centre",
    icon: Building2
  },
  {
    id: "supplier",
    title: "Supplier",
    shortTitle: "Supplier",
    description: "Manage catalogue, quotations, consolidated orders, deliveries and payments.",
    dashboardPath: "/dashboard/supplier",
    icon: Store
  },
  {
    id: "donor",
    title: "Donor",
    shortTitle: "Donor",
    description: "Browse verified centres, support projects, track impact and download reports.",
    dashboardPath: "/dashboard/donor",
    icon: HandHeart
  },
  {
    id: "funding_partner",
    title: "Funding Organisation",
    shortTitle: "Funder",
    description: "Publish opportunities, review applications, assess documents and report outcomes.",
    dashboardPath: "/dashboard/funding-partner",
    icon: Landmark
  }
];

export const roleIds = roleOptions.map((role) => role.id);

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && roleIds.includes(value as UserRole);
}

export function getRoleOption(role: UserRole) {
  return roleOptions.find((option) => option.id === role) ?? roleOptions[1];
}

export function getDashboardPath(role: UserRole) {
  return getRoleOption(role).dashboardPath;
}
