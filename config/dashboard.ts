import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Download,
  FileCheck2,
  FileText,
  FolderKanban,
  HandCoins,
  HeartHandshake,
  Home,
  Inbox,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  PackageCheck,
  PieChart,
  PlaySquare,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  UsersRound,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/lib/auth/roles";

export type Permission =
  | "centres:read"
  | "centres:manage"
  | "memberships:manage"
  | "procurement:read"
  | "procurement:manage"
  | "suppliers:manage"
  | "funding:read"
  | "funding:manage"
  | "compliance:read"
  | "compliance:manage"
  | "reports:read"
  | "analytics:read"
  | "settings:manage"
  | "messages:read"
  | "donations:manage"
  | "assessments:manage"
  | "intelligence:read";

export type NavigationItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  badge?: string;
};

export type DashboardCard = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  href: string;
};

export type RoleDashboardConfig = {
  role: UserRole;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  basePath: string;
  icon: LucideIcon;
  permissions: Permission[];
  navigation: NavigationItem[];
  cards: DashboardCard[];
};

export const roleDashboardConfig: Record<UserRole, RoleDashboardConfig> = {
  super_admin: {
    role: "super_admin",
    label: "Super Admin",
    eyebrow: "ECDLink command centre",
    title: "Super Admin Workspace",
    description: "Operate centres, memberships, procurement, suppliers, funding, compliance, analytics and reporting.",
    basePath: "/dashboard/super-admin",
    icon: ShieldCheck,
    permissions: [
      "centres:manage",
      "memberships:manage",
      "procurement:manage",
      "suppliers:manage",
      "funding:manage",
      "compliance:manage",
      "reports:read",
      "analytics:read",
      "settings:manage",
      "messages:read",
      "donations:manage",
      "intelligence:read"
    ],
    navigation: [
      { title: "Dashboard", href: "/dashboard/super-admin", icon: LayoutDashboard },
      { title: "Centres", href: "/dashboard/super-admin/centres", icon: Building2, permission: "centres:manage" },
      { title: "Memberships", href: "/dashboard/super-admin/memberships", icon: WalletCards, permission: "memberships:manage" },
      { title: "Procurement", href: "/dashboard/super-admin/procurement", icon: ShoppingCart, permission: "procurement:manage" },
      { title: "Suppliers", href: "/dashboard/super-admin/suppliers", icon: Store, permission: "suppliers:manage" },
      { title: "Partners", href: "/dashboard/super-admin/partners", icon: HeartHandshake, permission: "donations:manage" },
      { title: "Intelligence", href: "/dashboard/super-admin/intelligence", icon: Lightbulb, permission: "intelligence:read" },
      { title: "Funding", href: "/dashboard/super-admin/funding", icon: HandCoins, permission: "funding:manage", badge: "38" },
      { title: "Compliance", href: "/dashboard/super-admin/compliance", icon: ClipboardCheck, permission: "compliance:manage" },
      { title: "Reports", href: "/dashboard/super-admin/reports", icon: FileText, permission: "reports:read" },
      { title: "Analytics", href: "/dashboard/super-admin/analytics", icon: BarChart3, permission: "analytics:read" },
      { title: "Notifications", href: "/dashboard/super-admin/notifications", icon: Bell, badge: "9" },
      { title: "Settings", href: "/dashboard/super-admin/settings", icon: Settings, permission: "settings:manage" }
    ],
    cards: [
      { title: "Centres", value: "16", description: "Active ECD centres onboarded", icon: Building2, href: "/dashboard/super-admin/centres" },
      { title: "Procurement", value: "R248k", description: "Monthly network order value", icon: ShoppingCart, href: "/dashboard/super-admin/procurement" },
      { title: "Compliance", value: "72%", description: "Average readiness score", icon: ClipboardCheck, href: "/dashboard/super-admin/compliance" },
      { title: "Funding", value: "38", description: "Applications in pipeline", icon: HandCoins, href: "/dashboard/super-admin/funding" }
    ]
  },
  ecd_centre: {
    role: "ecd_centre",
    label: "ECD Centre",
    eyebrow: "Centre operations",
    title: "ECD Centre Workspace",
    description: "Manage your centre profile, membership, procurement, compliance, funding, events and communication.",
    basePath: "/dashboard/ecd-centre",
    icon: Building2,
    permissions: ["procurement:read", "funding:read", "compliance:read", "reports:read", "messages:read", "intelligence:read"],
    navigation: [
      { title: "Dashboard", href: "/dashboard/ecd-centre", icon: LayoutDashboard },
      { title: "My Centre", href: "/dashboard/ecd-centre/my-centre", icon: Home },
      { title: "Membership", href: "/dashboard/ecd-centre/membership", icon: WalletCards },
      { title: "Monthly Procurement", href: "/dashboard/ecd-centre/procurement", icon: ShoppingCart, permission: "procurement:read" },
      { title: "Compliance Documents", href: "/dashboard/ecd-centre/compliance", icon: ClipboardCheck, permission: "compliance:read" },
      { title: "Funding Readiness", href: "/dashboard/ecd-centre/funding", icon: HandCoins, permission: "funding:read", badge: "4" },
      { title: "Assistant", href: "/dashboard/ecd-centre/intelligence", icon: Lightbulb, permission: "intelligence:read" },
      { title: "Applications", href: "/dashboard/ecd-centre/applications", icon: FolderKanban },
      { title: "Downloads", href: "/dashboard/ecd-centre/downloads", icon: Download },
      { title: "Events", href: "/dashboard/ecd-centre/events", icon: CalendarDays },
      { title: "SmartKids TV", href: "/dashboard/ecd-centre/smartkids-tv", icon: PlaySquare },
      { title: "Messages", href: "/dashboard/ecd-centre/messages", icon: MessageSquare, permission: "messages:read", badge: "2" },
      { title: "Support", href: "/dashboard/ecd-centre/support", icon: Inbox }
    ],
    cards: [
      { title: "Membership", value: "Active", description: "Renews 30 Nov 2026", icon: WalletCards, href: "/dashboard/ecd-centre/membership" },
      { title: "Procurement", value: "R12.4k", description: "Used from monthly budget", icon: ShoppingCart, href: "/dashboard/ecd-centre/procurement" },
      { title: "Compliance", value: "72%", description: "3 documents need attention", icon: ClipboardCheck, href: "/dashboard/ecd-centre/compliance" },
      { title: "Funding", value: "4", description: "Matched opportunities", icon: HandCoins, href: "/dashboard/ecd-centre/funding" }
    ]
  },
  supplier: {
    role: "supplier",
    label: "Supplier",
    eyebrow: "Supplier operations",
    title: "Supplier Workspace",
    description: "Manage products, orders, deliveries, invoices, payments and supplier reports.",
    basePath: "/dashboard/supplier",
    icon: Store,
    permissions: ["procurement:read", "reports:read", "intelligence:read"],
    navigation: [
      { title: "Dashboard", href: "/dashboard/supplier", icon: LayoutDashboard },
      { title: "Products", href: "/dashboard/supplier/products", icon: PackageCheck },
      { title: "Orders", href: "/dashboard/supplier/orders", icon: ShoppingCart, badge: "6" },
      { title: "Quotations", href: "/dashboard/supplier/quotations", icon: ClipboardList },
      { title: "Deliveries", href: "/dashboard/supplier/deliveries", icon: Truck },
      { title: "Invoices", href: "/dashboard/supplier/invoices", icon: ReceiptText },
      { title: "Payments", href: "/dashboard/supplier/payments", icon: CreditCard },
      { title: "Reports", href: "/dashboard/supplier/reports", icon: FileText },
      { title: "Assistant", href: "/dashboard/supplier/intelligence", icon: Lightbulb, permission: "intelligence:read" },
      { title: "Settings", href: "/dashboard/supplier/settings", icon: Settings }
    ],
    cards: [
      { title: "Products", value: "248", description: "Catalogue items", icon: PackageCheck, href: "/dashboard/supplier/products" },
      { title: "Orders", value: "6", description: "Open consolidated orders", icon: ShoppingCart, href: "/dashboard/supplier/orders" },
      { title: "Deliveries", value: "18", description: "Centre packs in motion", icon: Truck, href: "/dashboard/supplier/deliveries" },
      { title: "Payments", value: "R82k", description: "Paid this cycle", icon: CreditCard, href: "/dashboard/supplier/payments" }
    ]
  },
  donor: {
    role: "donor",
    label: "Donor / CSI Partner",
    eyebrow: "Impact workspace",
    title: "Donor / CSI Workspace",
    description: "Browse centres, sponsor projects, track donations, view impact reports and message ECDLink.",
    basePath: "/dashboard/donor",
    icon: HeartHandshake,
    permissions: ["centres:read", "reports:read", "messages:read", "donations:manage", "intelligence:read"],
    navigation: [
      { title: "Dashboard", href: "/dashboard/donor", icon: LayoutDashboard },
      { title: "Browse Centres", href: "/dashboard/donor/centres", icon: Building2, permission: "centres:read" },
      { title: "Projects", href: "/dashboard/donor/projects", icon: FolderKanban },
      { title: "Partnership Requests", href: "/dashboard/donor/partnerships", icon: HandCoins, permission: "donations:manage" },
      { title: "Impact Reports", href: "/dashboard/donor/impact-reports", icon: PieChart, permission: "reports:read" },
      { title: "Assistant", href: "/dashboard/donor/intelligence", icon: Lightbulb, permission: "intelligence:read" },
      { title: "Messages", href: "/dashboard/donor/messages", icon: MessageSquare, permission: "messages:read" },
      { title: "Profile", href: "/dashboard/donor/profile", icon: UsersRound }
    ],
    cards: [
      { title: "Verified Centres", value: "16", description: "Ready for support", icon: Building2, href: "/dashboard/donor/centres" },
      { title: "Projects", value: "9", description: "Active funding needs", icon: FolderKanban, href: "/dashboard/donor/projects" },
      { title: "Impact", value: "842", description: "Children reached", icon: PieChart, href: "/dashboard/donor/impact-reports" },
      { title: "Reports", value: "12", description: "CSI-ready downloads", icon: FileText, href: "/dashboard/donor/impact-reports" }
    ]
  },
  funding_partner: {
    role: "funding_partner",
    label: "Funding Organisation",
    eyebrow: "Funding operations",
    title: "Funding Organisation Workspace",
    description: "Manage funding calls, applications, assessments, approvals and reporting.",
    basePath: "/dashboard/funding-partner",
    icon: Landmark,
    permissions: ["funding:manage", "assessments:manage", "reports:read", "intelligence:read"],
    navigation: [
      { title: "Dashboard", href: "/dashboard/funding-partner", icon: LayoutDashboard },
      { title: "Funding Calls", href: "/dashboard/funding-partner/funding-calls", icon: HandCoins },
      { title: "Applications", href: "/dashboard/funding-partner/applications", icon: FileText, badge: "38" },
      { title: "Assessments", href: "/dashboard/funding-partner/assessments", icon: ClipboardCheck, permission: "assessments:manage" },
      { title: "Approvals", href: "/dashboard/funding-partner/approvals", icon: FileCheck2 },
      { title: "Assistant", href: "/dashboard/funding-partner/intelligence", icon: Lightbulb, permission: "intelligence:read" },
      { title: "Reports", href: "/dashboard/funding-partner/reports", icon: BarChart3, permission: "reports:read" }
    ],
    cards: [
      { title: "Funding Calls", value: "5", description: "Open programmes", icon: HandCoins, href: "/dashboard/funding-partner/funding-calls" },
      { title: "Applications", value: "38", description: "Centre submissions", icon: FileText, href: "/dashboard/funding-partner/applications" },
      { title: "Assessments", value: "11", description: "Under review", icon: ClipboardCheck, href: "/dashboard/funding-partner/assessments" },
      { title: "Approvals", value: "7", description: "Approved projects", icon: FileCheck2, href: "/dashboard/funding-partner/approvals" }
    ]
  }
};

export function getDashboardConfig(role: UserRole) {
  return roleDashboardConfig[role];
}

export function getRoleNavigation(role: UserRole, permissions: Permission[] = roleDashboardConfig[role].permissions) {
  return roleDashboardConfig[role].navigation.filter((item) => !item.permission || permissions.includes(item.permission));
}

export function hasPermission(role: UserRole, permission: Permission) {
  return roleDashboardConfig[role].permissions.includes(permission);
}
