import { notFound } from "next/navigation";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { EmptyState } from "@/components/states/app-states";
import type { UserRole } from "@/lib/auth/roles";

const roleSlugMap: Record<string, UserRole> = {
  "super-admin": "super_admin",
  "ecd-centre": "ecd_centre",
  supplier: "supplier",
  donor: "donor",
  "funding-partner": "funding_partner"
};

function formatTitle(segment: string) {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function DashboardPlaceholderPage({
  params
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  const role = roleSlugMap[segments[0]];

  if (!role) {
    notFound();
  }

  const moduleName = formatTitle(segments[segments.length - 1] ?? "Module");

  return (
    <RoleDashboardShell role={role}>
      <EmptyState
        title={`${moduleName} module shell`}
        description="This route is wired into the role-based dashboard architecture and is ready for its future module implementation."
      />
    </RoleDashboardShell>
  );
}
