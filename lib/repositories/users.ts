import {
  Prisma,
  type CentreUserRole,
  type UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  permissionsForPlatformRole,
  platformRoles,
  type DatabaseUserRole,
} from "@/lib/auth/rbac";

export type SyncUserInput = {
  clerkUserId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
};

function toAuditJson(
  value: unknown
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value)
  ) as Prisma.InputJsonValue;
}

export async function seedRolesAndPermissions() {
  for (const [key, role] of Object.entries(
    platformRoles
  ) as Array<
    [
      DatabaseUserRole,
      (typeof platformRoles)[DatabaseUserRole],
    ]
  >) {
    const dbRole = await prisma.role.upsert({
      where: {
        key,
      },
      update: {
        name: role.name,
      },
      create: {
        key,
        name: role.name,
      },
    });

    for (const permissionKey of role.permissions) {
      const permission =
        await prisma.permission.upsert({
          where: {
            key: permissionKey,
          },
          update: {},
          create: {
            key: permissionKey,
            name: permissionKey,
          },
        });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: dbRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: dbRole.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

export async function upsertUserFromClerk(
  input: SyncUserInput
) {
  const role = input.role ?? "ECD_CENTRE";

  const roleRecord = await prisma.role.upsert({
    where: {
      key: role,
    },
    update: {},
    create: {
      key: role,
      name:
        platformRoles[role as DatabaseUserRole]
          ?.name ?? role,
    },
  });

  return prisma.user.upsert({
    where: {
      clerkUserId: input.clerkUserId,
    },
    create: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role,
      roleId: roleRecord.id,
      status: "ACTIVE",
      lastLoginAt: new Date(),
    },
    update: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role,
      roleId: roleRecord.id,
      status: "ACTIVE",
      lastLoginAt: new Date(),
    },
  });
}

export async function archiveUserFromClerk(
  clerkUserId: string
) {
  return prisma.user.update({
    where: {
      clerkUserId,
    },
    data: {
      status: "ARCHIVED",
      sessions: {
        updateMany: {
          where: {
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        },
      },
    },
  });
}

export async function getInternalUserByClerkId(
  clerkUserId: string
) {
  return prisma.user.findUnique({
    where: {
      clerkUserId,
    },
    include: {
      roleRecord: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      centreUsers: {
        where: {
          status: "ACTIVE",
        },
        include: {
          centre: true,
        },
      },
      supplierUsers: {
        include: {
          supplier: true,
        },
      },
      donorUsers: {
        include: {
          organisation: true,
        },
      },
      fundingUsers: {
        include: {
          organisation: true,
        },
      },
    },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    include: {
      centreUsers: {
        include: {
          centre: true,
        },
      },
      roleRecord: true,
    },
    orderBy: [
      {
        status: "asc",
      },
      {
        email: "asc",
      },
    ],
  });
}

export async function changeUserRole(
  userId: string,
  role: UserRole,
  actorUserId?: string
) {
  const roleRecord = await prisma.role.findUnique({
    where: {
      key: role,
    },
  });

  const before = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  const after = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      role,
      roleId: roleRecord?.id,
    },
    include: {
      roleRecord: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action: "user.role.change",
      entityType: "User",
      entityId: userId,
      before: before
        ? toAuditJson(before)
        : Prisma.JsonNull,
      after: toAuditJson(after),
    },
  });

  return after;
}

export async function setUserStatus(
  userId: string,
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED",
  actorUserId?: string
) {
  const before = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  const after = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      status,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action: "user.status.change",
      entityType: "User",
      entityId: userId,
      before: before
        ? toAuditJson(before)
        : Prisma.JsonNull,
      after: toAuditJson(after),
    },
  });

  return after;
}

export async function recordSession(input: {
  userId: string;
  clerkSessionId?: string;
  provider: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  if (input.clerkSessionId) {
    return prisma.session.upsert({
      where: {
        clerkSessionId: input.clerkSessionId,
      },
      update: {
        lastSeenAt: new Date(),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      create: input,
    });
  }

  return prisma.session.create({
    data: input,
  });
}

export async function assignUserToCentre(input: {
  userId: string;
  centreId: string;
  role: CentreUserRole;
  permissions?: string[];
  isPrimary?: boolean;
  title?: string;
  actorUserId?: string;
}) {
  const ownership = await prisma.centreUser.upsert({
    where: {
      centreId_userId: {
        centreId: input.centreId,
        userId: input.userId,
      },
    },
    update: {
      role: input.role,
      permissions: input.permissions ?? [],
      isPrimary: input.isPrimary ?? false,
      title: input.title,
      status: "ACTIVE",
      removedAt: null,
    },
    create: {
      centreId: input.centreId,
      userId: input.userId,
      role: input.role,
      permissions: input.permissions ?? [],
      isPrimary: input.isPrimary ?? false,
      title: input.title,
      status: "ACTIVE",
    },
    include: {
      centre: true,
      user: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "centre.membership.assign",
      entityType: "CentreUser",
      entityId: ownership.id,
      after: toAuditJson(ownership),
    },
  });

  return ownership;
}

export async function removeUserFromCentre(
  centreUserId: string,
  actorUserId?: string
) {
  const before = await prisma.centreUser.findUnique({
    where: {
      id: centreUserId,
    },
  });

  const after = await prisma.centreUser.update({
    where: {
      id: centreUserId,
    },
    data: {
      status: "REMOVED",
      removedAt: new Date(),
      isPrimary: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action: "centre.membership.remove",
      entityType: "CentreUser",
      entityId: centreUserId,
      before: before
        ? toAuditJson(before)
        : Prisma.JsonNull,
      after: toAuditJson(after),
    },
  });

  return after;
}

export async function getUserPermissions(
  clerkUserId: string
) {
  const user =
    await getInternalUserByClerkId(clerkUserId);

  if (!user) {
    return [];
  }

  const rolePermissions =
    user.roleRecord?.permissions.map(
      (item) => item.permission.key
    ) ??
    permissionsForPlatformRole(
      user.role as DatabaseUserRole
    );

  const centrePermissions =
    user.centreUsers.flatMap(
      (item) => item.permissions
    );

  return Array.from(
    new Set([
      ...rolePermissions,
      ...centrePermissions,
    ])
  );
}