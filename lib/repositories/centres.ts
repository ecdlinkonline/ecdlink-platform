import { prisma } from "@/lib/db/prisma";
import {
  activityToDb,
  complianceToDb,
  mapDbCentreToDto,
  membershipToDb,
  participationToDb,
  readinessToDb,
  registrationToDb
} from "@/lib/db/mappers";
import type { CentreFilters, EcdCentre } from "@/lib/centres/types";
import type { CentreUpdateInput } from "@/lib/validators/centres";

const centreInclude = { photos: true, centreNotes: true, activities: { orderBy: { createdAt: "desc" as const } } };

export async function listCentresFromDb(filters: CentreFilters = {}) {
  const where = {
    archivedAt: null,
    ...(filters.area && filters.area !== "All" ? { area: filters.area } : {}),
    ...(filters.query
      ? {
          OR: [
            { centreName: { contains: filters.query, mode: "insensitive" as const } },
            { principalName: { contains: filters.query, mode: "insensitive" as const } },
            { area: { contains: filters.query, mode: "insensitive" as const } },
            { region: { contains: filters.query, mode: "insensitive" as const } },
            { npoNumber: { contains: filters.query, mode: "insensitive" as const } },
            { dbeRegistrationStatus: { contains: filters.query, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const centres = await prisma.ecdCentre.findMany({ where, include: centreInclude, orderBy: { centreName: "asc" } });
  return centres.map(mapDbCentreToDto).filter((centre) => {
    return (
      (!filters.registrationStatus || filters.registrationStatus === "All" || centre.registrationStatus === filters.registrationStatus) &&
      (!filters.complianceStatus || filters.complianceStatus === "All" || centre.complianceStatus === filters.complianceStatus) &&
      (!filters.membershipStatus || filters.membershipStatus === "All" || centre.membershipStatus === filters.membershipStatus) &&
      (!filters.procurementStatus || filters.procurementStatus === "All" || centre.procurementStatus === filters.procurementStatus)
    );
  });
}

export async function getCentreBySlugFromDb(slug: string) {
  const centre = await prisma.ecdCentre.findUnique({ where: { slug }, include: centreInclude });
  return centre ? mapDbCentreToDto(centre) : null;
}

export async function getCentreAreasFromDb() {
  const rows = await prisma.ecdCentre.findMany({
    where: { archivedAt: null, area: { not: null } },
    select: { area: true },
    distinct: ["area"],
    orderBy: { area: "asc" }
  });
  return rows.map((row) => row.area).filter((area): area is string => Boolean(area));
}

export async function updateCentreProfileInDb(
  slug: string,
  input: CentreUpdateInput,
  actorUserId?: string,
  authenticatedUserId?: string
) {
  return prisma.$transaction(async (tx) => {
    const beforeRecord = await tx.ecdCentre.findUnique({ where: { slug }, include: centreInclude });
    const before = beforeRecord ? mapDbCentreToDto(beforeRecord) : null;
    const centre = await tx.ecdCentre.update({
      where: { slug },
      data: {
        centreName: input.centreName,
        principalName: input.principalName,
        contactPerson: input.contactPerson,
        phone: input.phoneNumber,
        email: input.emailAddress,
        physicalAddress: input.physicalAddress,
        npoNumber: input.npoNumber,
        dbeRegistrationStatus: input.dbeRegistrationStatus,
        area: input.area,
        region: input.region,
        numberOfChildren: input.numberOfChildren,
        numberOfStaff: input.numberOfStaff,
        activities: {
          create: {
            title: "Profile updated",
            description: "Centre profile details were updated in the production database.",
            type: "PROFILE"
          }
        }
      },
      include: centreInclude
    });
    const after = mapDbCentreToDto(centre);
    const [databaseContext, transactionActor] = await Promise.all([
      tx.$queryRaw<Array<{ databaseName: string; currentSchema: string }>>`
        SELECT current_database() AS "databaseName", current_schema() AS "currentSchema"
      `,
      actorUserId
        ? tx.user.findUnique({ where: { id: actorUserId }, select: { id: true, clerkUserId: true } })
        : Promise.resolve(null)
    ]);
    console.info("[centre-audit-diagnostic]", {
      clerkUserId: authenticatedUserId ?? null,
      internalUserId: actorUserId ?? null,
      databaseName: databaseContext[0]?.databaseName ?? null,
      currentSchema: databaseContext[0]?.currentSchema ?? null,
      actorExistsInTransaction: Boolean(transactionActor),
      auditActorUserId: actorUserId ?? null,
      actorClerkIdMatchesAuthenticatedRequest: Boolean(
        transactionActor && authenticatedUserId && transactionActor.clerkUserId === authenticatedUserId
      )
    });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "centre.profile.update",
        entityType: "EcdCentre",
        entityId: centre.id,
        before: before === null ? undefined : JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(after))
      }
    });
    return after;
  });
}

export function seededCentreToDbCreate(centre: EcdCentre) {
  return {
    centreName: centre.centreName,
    slug: centre.id,
    registrationStatus: registrationToDb[centre.registrationStatus],
    npoNumber: centre.npoNumber || null,
    dbeRegistrationStatus: centre.dbeRegistrationStatus || null,
    partialCareStatus: centre.dbeRegistrationStatus?.toLowerCase().includes("partial") ? centre.dbeRegistrationStatus : null,
    physicalAddress: centre.physicalAddress || null,
    area: centre.area || null,
    region: centre.region || null,
    province: centre.region || null,
    contactPerson: centre.contactPerson || null,
    phone: centre.phoneNumber || null,
    email: centre.emailAddress || null,
    principalName: centre.principalName || null,
    numberOfChildren: centre.numberOfChildren,
    numberOfStaff: centre.numberOfStaff,
    membershipStatus: membershipToDb[centre.membershipStatus],
    procurementStatus: participationToDb[centre.procurementStatus],
    complianceStatus: complianceToDb[centre.complianceStatus],
    fundingReadinessStatus: readinessToDb[centre.fundingReadinessStatus],
    photos: { create: centre.centrePhotos.map((photo) => ({ title: photo.title, tone: photo.tone, uploadedAt: new Date(photo.uploadedAt) })) },
    centreNotes: { create: centre.notes.map((note) => ({ author: note.author, body: note.body, createdAt: new Date(note.createdAt) })) },
    activities: { create: centre.activityTimeline.map((activity) => ({ title: activity.title, description: activity.description, type: activityToDb[activity.type], createdAt: new Date(activity.createdAt) })) }
  };
}
