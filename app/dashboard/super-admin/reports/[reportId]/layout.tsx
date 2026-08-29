import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";

export default function GrantReportLayout({ children }: { children: React.ReactNode }) {
  return <RoleDashboardShell role="super_admin">{children}</RoleDashboardShell>;
}
