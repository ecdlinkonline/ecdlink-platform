import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/rbac";
import { getAuthContext } from "@/lib/auth/session";
import { hasDatabaseConfig } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import {
  getInternalUserByClerkId,
  getUserPermissions,
  recordSession,
  upsertUserFromClerk
} from "@/lib/repositories/users";
import type { UserRole } from "@/lib/auth/roles";

function mapRole(role: UserRole | null) {
  if (role === "super_admin") return "SUPER_ADMIN";
  if (role === "ecdlink_staff") return "ECDLINK_STAFF";
  if (role === "supplier") return "SUPPLIER";
  if (role === "donor") return "DONOR";
  if (role === "funding_partner") return "FUNDING_ORGANISATION";
  return "ECD_CENTRE";
}

export async function requireAuthenticatedUser() {
  const authContext = await getAuthContext();
  if (!authContext) redirect("/auth/sign-in");
  return authContext;
}

export async function syncCurrentUserOnLogin(requestMeta?: { ipAddress?: string; userAgent?: string }) {
  if (!hasDatabaseConfig()) return null;
  const authContext = await getAuthContext();
  if (!authContext || authContext.provider !== "clerk") return null;
  const clerkSession = await clerkAuth();
  const clerkUser = await currentUser();
  const user = await upsertUserFromClerk({
    clerkUserId: authContext.userId,
    email: clerkUser?.primaryEmailAddress?.emailAddress,
    firstName: clerkUser?.firstName ?? undefined,
    lastName: clerkUser?.lastName ?? undefined,
    phone: clerkUser?.primaryPhoneNumber?.phoneNumber,
    role: mapRole(authContext.role)
  });

  await recordSession({
    userId: user.id,
    clerkSessionId: clerkSession.sessionId ?? undefined,
    provider: "clerk",
    ipAddress: requestMeta?.ipAddress,
    userAgent: requestMeta?.userAgent
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      metadata: { provider: "clerk" }
    }
  });

  return user;
}

export async function requireInternalUser() {
  const authContext = await requireAuthenticatedUser();
  if (!hasDatabaseConfig()) return { authContext, internalUser: null, permissions: [] };
  const internalUser = await getInternalUserByClerkId(authContext.userId);
  if (!internalUser || internalUser.status !== "ACTIVE") redirect("/auth/sign-in");
  const permissions = await getUserPermissions(authContext.userId);
  return { authContext, internalUser, permissions };
}

export async function requireRole(...roles: UserRole[]) {
  const authContext = await requireAuthenticatedUser();
  if (!authContext.role || !roles.includes(authContext.role)) redirect("/dashboard");
  if (hasDatabaseConfig()) {
    const user = await getInternalUserByClerkId(authContext.userId);
    if (!user || user.status !== "ACTIVE") redirect("/auth/sign-in");
  }
  return authContext;
}

export async function requireSuperAdmin() {
  return requireRole("super_admin");
}

export async function requirePermission(permission: string) {
  const context = await requireInternalUser();
  if (context.authContext.role === "super_admin") return context;
  if (!hasPermission(context.permissions, permission)) redirect("/dashboard");
  return context;
}

export async function requireCentreOwnership(centreIdOrSlug: string, permission = "centre:read") {
  const context = await requireInternalUser();
  if (context.authContext.role === "super_admin") return context;
  if (context.authContext.role !== "ecd_centre" || !context.internalUser) redirect("/dashboard");

  const ownership = context.internalUser.centreUsers.find((item) =>
    item.status === "ACTIVE" &&
    (item.centreId === centreIdOrSlug || item.centre.slug === centreIdOrSlug) &&
    hasPermission([...item.permissions, ...context.permissions], permission)
  );

  if (!ownership) redirect("/dashboard");
  return { ...context, ownership };
}

export async function requireCentre(centreIdOrSlug: string) {
  return requireCentreOwnership(centreIdOrSlug, "centre:read");
}

export async function requireCentreAccess(centreIdOrSlug: string) {
  return requireCentre(centreIdOrSlug);
}

export async function requireSupplier(supplierIdOrSlug: string) {
  const context = await requireInternalUser();
  if (context.authContext.role === "super_admin") return context;
  if (context.authContext.role !== "supplier" || !context.internalUser) redirect("/dashboard");
  const ownership = context.internalUser.supplierUsers.find((item) => item.supplierId === supplierIdOrSlug || item.supplier.slug === supplierIdOrSlug);
  if (!ownership) redirect("/dashboard");
  return { ...context, ownership };
}

export async function requireSupplierAccess(supplierIdOrSlug: string) {
  return requireSupplier(supplierIdOrSlug);
}

export async function requireDonor(donorOrganisationIdOrSlug: string) {
  const context = await requireInternalUser();
  if (context.authContext.role === "super_admin") return context;
  if (context.authContext.role !== "donor" || !context.internalUser) redirect("/dashboard");
  const ownership = context.internalUser.donorUsers.find((item) => item.donorOrganisationId === donorOrganisationIdOrSlug || item.organisation.slug === donorOrganisationIdOrSlug);
  if (!ownership) redirect("/dashboard");
  return { ...context, ownership };
}

export async function requireDonorAccess(donorOrganisationIdOrSlug: string) {
  return requireDonor(donorOrganisationIdOrSlug);
}

export async function requireFundingPartner(fundingOrganisationIdOrSlug: string) {
  const context = await requireInternalUser();
  if (context.authContext.role === "super_admin") return context;
  if (context.authContext.role !== "funding_partner" || !context.internalUser) redirect("/dashboard");
  const ownership = context.internalUser.fundingUsers.find((item) => item.fundingOrganisationId === fundingOrganisationIdOrSlug || item.organisation.slug === fundingOrganisationIdOrSlug);
  if (!ownership) redirect("/dashboard");
  return { ...context, ownership };
}

export async function requireFundingOrganisationAccess(fundingOrganisationIdOrSlug: string) {
  return requireFundingPartner(fundingOrganisationIdOrSlug);
}

export async function requireEcdlinkStaff() {
  const context = await requireInternalUser();
  if (context.authContext.role !== "ecdlink_staff" || !context.internalUser) redirect("/dashboard");

  const staffProfile = await prisma.ecdlinkStaffProfile.findUnique({
    where: { userId: context.internalUser.id },
    include: {
      centreAssignments: {
        where: { isActive: true },
        include: { centre: true },
        orderBy: [{ isPrimary: "desc" }, { assignedAt: "desc" }]
      }
    }
  });

  if (
    !staffProfile ||
    !staffProfile.isActive ||
    staffProfile.employmentStatus === "TERMINATED" ||
    staffProfile.employmentStatus === "SUSPENDED"
  ) {
    redirect("/auth/sign-in");
  }

  return { ...context, staffProfile };
}

export async function requireEcdlinkStaffCentreOwnership(centreIdOrSlug: string) {
  const context = await requireEcdlinkStaff();
  const assignment = context.staffProfile.centreAssignments.find(
    (item) => item.centreId === centreIdOrSlug || item.centre.slug === centreIdOrSlug
  );
  if (!assignment) redirect("/ecdlink/dashboard");
  return { ...context, assignment };
}
