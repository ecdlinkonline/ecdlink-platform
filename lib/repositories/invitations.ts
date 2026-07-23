import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { assignUserToCentre } from "@/lib/repositories/users";
import type { InvitationCreateInput } from "@/lib/validators/identity";

export async function listInvitations() {
  return prisma.invitation.findMany({
    include: { centre: true, invitedBy: true, acceptedBy: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function createInvitation(input: InvitationCreateInput, invitedByUserId?: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);
  const token = crypto.randomBytes(32).toString("hex");

  const invitation = await prisma.invitation.create({
    data: {
      email: input.email.toLowerCase(),
      token,
      invitedRole: input.invitedRole,
      centreId: input.centreId,
      centreRole: input.centreRole,
      permissions: input.permissions,
      invitedByUserId,
      expiresAt
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: invitedByUserId,
      action: "invitation.create",
      entityType: "Invitation",
      entityId: invitation.id,
      after: JSON.parse(JSON.stringify(invitation))
    }
  });

  return { ...invitation, emailPlaceholder: `Invitation email placeholder for ${invitation.email}` };
}

export async function acceptInvitation(token: string, clerkUserId: string) {
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    throw new Error("Invitation is invalid or expired.");
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) throw new Error("Internal user record not found.");

  const accepted = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { role: invitation.invitedRole, status: "ACTIVE" }
    });

    const updatedInvitation = await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByUserId: user.id }
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "invitation.accept",
        entityType: "Invitation",
        entityId: invitation.id,
        after: JSON.parse(JSON.stringify(updatedInvitation))
      }
    });

    return { updatedUser, updatedInvitation };
  });

  if (invitation.centreId && invitation.centreRole) {
    await assignUserToCentre({
      userId: user.id,
      centreId: invitation.centreId,
      role: invitation.centreRole,
      permissions: invitation.permissions,
      isPrimary: false,
      actorUserId: user.id
    });
  }

  return accepted;
}
