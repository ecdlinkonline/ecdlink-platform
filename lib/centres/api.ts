import { seededCentres } from "@/lib/centres/seed";
import type { CentreFilters, EcdCentre } from "@/lib/centres/types";
import { hasDatabaseConfig } from "@/lib/db/env";
import { getCentreAreasFromDb, getCentreBySlugFromDb, listCentresFromDb, updateCentreProfileInDb } from "@/lib/repositories/centres";
import { centreUpdateSchema, type CentreUpdateInput } from "@/lib/validators/centres";

export async function listCentres(filters: CentreFilters = {}) {
  if (hasDatabaseConfig()) {
    return listCentresFromDb(filters);
  }

  let centres = [...seededCentres];

  if (filters.query) {
    const query = filters.query.toLowerCase();
    centres = centres.filter((centre) =>
      [centre.centreName, centre.area, centre.region, centre.principalName, centre.npoNumber, centre.dbeRegistrationStatus]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  if (filters.area && filters.area !== "All") {
    centres = centres.filter((centre) => centre.area === filters.area);
  }

  if (filters.registrationStatus && filters.registrationStatus !== "All") {
    centres = centres.filter((centre) => centre.registrationStatus === filters.registrationStatus);
  }

  if (filters.complianceStatus && filters.complianceStatus !== "All") {
    centres = centres.filter((centre) => centre.complianceStatus === filters.complianceStatus);
  }

  if (filters.membershipStatus && filters.membershipStatus !== "All") {
    centres = centres.filter((centre) => centre.membershipStatus === filters.membershipStatus);
  }

  if (filters.procurementStatus && filters.procurementStatus !== "All") {
    centres = centres.filter((centre) => centre.procurementStatus === filters.procurementStatus);
  }

  return centres;
}

export async function getCentreById(id: string) {
  if (hasDatabaseConfig()) {
    return getCentreBySlugFromDb(id);
  }

  return seededCentres.find((centre) => centre.id === id) ?? null;
}

export async function getCurrentUserCentre() {
  if (hasDatabaseConfig()) {
    return (await getCentreBySlugFromDb("little-stars-ecd")) ?? seededCentres[0];
  }

  return seededCentres[0];
}

export async function getCentreAreas() {
  if (hasDatabaseConfig()) {
    return getCentreAreasFromDb();
  }

  return Array.from(new Set(seededCentres.map((centre) => centre.area))).sort();
}

export async function updateCentreProfile(
  id: string,
  input: Partial<EcdCentre> | CentreUpdateInput,
  actorUserId?: string,
  authenticatedUserId?: string
) {
  const parsed = centreUpdateSchema.partial().parse(input);

  if (hasDatabaseConfig()) {
    return updateCentreProfileInDb(id, parsed, actorUserId, authenticatedUserId);
  }

  const centre = await getCentreById(id);

  if (!centre) {
    return null;
  }

  return {
    ...centre,
    ...parsed,
    lastUpdatedDate: new Date().toISOString().slice(0, 10)
  };
}

export function getMissingProfileFields(centre: EcdCentre) {
  const required: Array<[keyof EcdCentre, string]> = [
    ["npoNumber", "NPO number"],
    ["dbeRegistrationStatus", "DBE registration / partial care status"],
    ["physicalAddress", "Physical address"],
    ["phoneNumber", "Phone number"],
    ["emailAddress", "Email address"],
    ["principalName", "Principal name"]
  ];

  return required.filter(([key]) => !centre[key] || centre[key] === "Pending").map(([, label]) => label);
}
