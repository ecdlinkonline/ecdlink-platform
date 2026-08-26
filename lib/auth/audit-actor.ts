export function internalAuditActorId(context: { internalUser: { id: string } }) {
  return context.internalUser.id;
}
