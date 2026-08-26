import type { Prisma, UserRole, UserStatus } from "@prisma/client";

export type OnboardingUserState = {
  role: UserRole;
  roleId: string | null;
  status: UserStatus;
};

export function isAwaitingSelfServiceOnboarding(user: OnboardingUserState | null) {
  return Boolean(
    user &&
    user.status === "INVITED" &&
    user.role === "ECD_CENTRE" &&
    user.roleId === null
  );
}

export function selfServiceOnboardingEligibilityWhere(userId: string): Prisma.UserWhereInput {
  return {
    id: userId,
    status: "INVITED",
    role: "ECD_CENTRE",
    roleId: null,
    centreUsers: { none: {} },
    supplierUsers: { none: {} },
    donorUsers: { none: {} },
    fundingUsers: { none: {} },
    ecdlinkStaffProfile: null
  };
}

export function selfServiceOnboardingCompletionData(role: UserRole, roleId: string): Prisma.UserUncheckedUpdateManyInput {
  return { role, roleId, status: "ACTIVE" };
}
