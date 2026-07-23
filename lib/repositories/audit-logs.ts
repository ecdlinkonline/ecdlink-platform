import { prisma } from "@/lib/db/prisma";

export async function createAuditLog(input: {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
      metadata: input.metadata === undefined ? undefined : JSON.parse(JSON.stringify(input.metadata))
    }
  });
}
