import { prisma } from "@/lib/db/prisma";
import {
  partnerStatusForDisplay,
  projectStatusForDisplay,
} from "@/lib/donor/format";
import type {
  DonorReport,
  ImpactCentre,
  ImpactProject,
  PartnerMessage,
  PartnerOrganisation,
  PartnershipRequest,
  ProjectCategory,
} from "@/lib/donor/types";

function numberValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  return Number(value ?? 0);
}

function dateValue(
  value: Date | string | null | undefined
) {
  return value
    ? new Date(value).toISOString().slice(0, 10)
    : "";
}

function projectCategoryValue(
  value: unknown
): ProjectCategory {
  return value as ProjectCategory;
}

function mapPartner(org: any): PartnerOrganisation {
  return {
    id: org.slug,
    name: org.organisationName ?? org.name,
    type: org.organisationType ?? org.type,
    contactPerson:
      org.contactPerson ?? "Partner contact",
    email: org.email ?? "",
    focusAreas: (org.focusAreas ?? []).slice(0, 4),
    status: partnerStatusForDisplay(
      org.status
    ) as PartnerOrganisation["status"],
    engagementScore: org.engagements?.length
      ? Math.min(
          98,
          55 + org.engagements.length * 4
        )
      : org.onboardingPercentage ?? 65,
  };
}

function mapCentre(centre: any): ImpactCentre {
  const complianceScore =
    centre.complianceStatus === "COMPLIANT"
      ? 92
      : centre.complianceStatus === "ATTENTION"
        ? 68
        : 42;

  const fundingReadiness =
    centre.fundingProfiles?.[0]?.readinessScore ??
    (centre.fundingReadinessStatus === "READY"
      ? 85
      : 55);

  const currentNeeds: ProjectCategory[] = Array.from(
    new Set<ProjectCategory>(
      (centre.impactProjects ?? []).map(
        (project: any) =>
          projectCategoryValue(
            project.projectType ??
              project.category
          )
      )
    )
  ).slice(0, 3);

  return {
    id: centre.slug,
    name: centre.centreName,
    location: [centre.area, centre.region]
      .filter(Boolean)
      .join(", "),
    province:
      centre.province ??
      centre.region ??
      "Western Cape",
    children: centre.numberOfChildren ?? 0,
    staff: centre.numberOfStaff ?? 0,
    registrationStatus:
      centre.registrationStatus.replaceAll(
        "_",
        " "
      ),
    complianceScore,
    fundingReadiness,
    membershipStatus: centre.membershipStatus,
    currentNeeds,
    activeProjectCount:
      (centre.impactProjects ?? []).length,
    imageTone: "bg-blue-100",
  };
}

function mapProject(project: any): ImpactProject {
  const budget = numberValue(
    project.totalBudget ?? project.budget
  );

  const committed = numberValue(
    project.amountCommitted
  );

  const category = projectCategoryValue(
    project.projectType ?? project.category
  );

  return {
    id: project.slug ?? project.id,
    centreId:
      project.centre?.slug ?? project.centreId,
    centreName:
      project.centre?.centreName ??
      "ECD centre",
    title: project.title,
    category,
    goal:
      project.summary ??
      project.problemStatement ??
      "Partner-ready ECD centre project.",
    budget,
    progress: budget
      ? Math.min(
          100,
          Math.round(
            (committed / budget) * 100
          )
        )
      : project.progress ?? 0,
    description:
      project.fullDescription ??
      project.description ??
      project.summary ??
      "Approved impact project for partner review.",
    impact: `${
      project.numberOfBeneficiaries ??
      project.centre?.numberOfChildren ??
      0
    } beneficiaries reached or targeted.`,
    requiredItems: project.supportNeeded?.length
      ? project.supportNeeded
      : (project.needs ?? [])
          .map((need: any) => need.itemName)
          .slice(0, 4),
    timeline:
      [
        dateValue(project.startDate),
        dateValue(project.endDate),
      ]
        .filter(Boolean)
        .join(" to ") ||
      "2026 implementation window",
    status: project.featured
      ? "Featured"
      : (projectStatusForDisplay(
          project.projectStatus ??
            project.status
        ) as ImpactProject["status"]),
    province:
      project.centre?.province ??
      project.centre?.region ??
      "Western Cape",
    photos: [
      {
        title: "Centre photo placeholder",
        tone: "bg-green-100",
      },
      {
        title: "Project photo placeholder",
        tone: "bg-blue-100",
      },
    ],
  };
}

function mapRequest(
  request: any
): PartnershipRequest {
  return {
    id: request.id,
    partnerId:
      request.donor?.slug ??
      request.donorOrganisationId,
    projectId:
      request.project?.slug ??
      request.impactProjectId ??
      "",
    type:
      request.requestType ??
      request.type,
    status:
      request.status === "Submitted"
        ? "New"
        : request.status ===
            "Under Review"
          ? "In Review"
          : request.status ===
              "Declined"
            ? "Closed"
            : request.status,
    createdAt: dateValue(request.createdAt),
  };
}

export async function listImpactCentresFromDb(
  filters: {
    query?: string;
    province?: string;
    need?: string;
  } = {}
) {
  const centres =
    await prisma.ecdCentre.findMany({
      where: {
        archivedAt: null,
      },
      include: {
        fundingProfiles: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
        impactProjects: {
          where: {
            approvedForPartnerPortal: true,
            archivedAt: null,
          },
          include: {
            needs: true,
          },
        },
      },
      orderBy: {
        centreName: "asc",
      },
    });

  const query =
    filters.query?.trim().toLowerCase() ??
    "";

  return centres
    .map(mapCentre)
    .filter((centre) => {
      const search = [
        centre.name,
        centre.location,
        centre.registrationStatus,
        centre.membershipStatus,
        centre.currentNeeds.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        !query || search.includes(query);

      const matchesProvince =
        !filters.province ||
        filters.province === "All" ||
        centre.province ===
          filters.province;

      const matchesNeed =
        !filters.need ||
        filters.need === "All" ||
        centre.currentNeeds.includes(
          filters.need as ProjectCategory
        );

      return (
        matchesQuery &&
        matchesProvince &&
        matchesNeed
      );
    });
}

export async function getImpactCentreFromDb(
  centreId: string
) {
  const centre =
    await prisma.ecdCentre.findFirst({
      where: {
        OR: [
          {
            id: centreId,
          },
          {
            slug: centreId,
          },
        ],
        archivedAt: null,
      },
      include: {
        fundingProfiles: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
        impactProjects: {
          where: {
            approvedForPartnerPortal: true,
            archivedAt: null,
          },
          include: {
            needs: true,
          },
        },
      },
    });

  return centre ? mapCentre(centre) : null;
}

export async function listImpactProjectsFromDb(
  filters: {
    query?: string;
    category?: string;
    status?: string;
    province?: string;
  } = {}
) {
  const projects =
    await prisma.impactProject.findMany({
      where: {
        approvedForPartnerPortal: true,
        archivedAt: null,
      },
      include: {
        centre: true,
        needs: true,
      },
      orderBy: [
        {
          featured: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

  const query =
    filters.query?.trim().toLowerCase() ??
    "";

  return projects
    .map(mapProject)
    .filter((project) => {
      const search = [
        project.title,
        project.centreName,
        project.category,
        project.province,
        project.description,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        !query || search.includes(query);

      const matchesCategory =
        !filters.category ||
        filters.category === "All" ||
        project.category === filters.category;

      const matchesStatus =
        !filters.status ||
        filters.status === "All" ||
        project.status === filters.status;

      const matchesProvince =
        !filters.province ||
        filters.province === "All" ||
        project.province ===
          filters.province;

      return (
        matchesQuery &&
        matchesCategory &&
        matchesStatus &&
        matchesProvince
      );
    });
}

export async function getImpactProjectFromDb(
  projectId: string
) {
  const project =
    await prisma.impactProject.findFirst({
      where: {
        OR: [
          {
            id: projectId,
          },
          {
            slug: projectId,
          },
        ],
        approvedForPartnerPortal: true,
        archivedAt: null,
      },
      include: {
        centre: true,
        needs: true,
        reports: true,
        updates: true,
      },
    });

  return project ? mapProject(project) : null;
}

export async function listPartnersFromDb(
  filters: {
    type?: string;
    query?: string;
  } = {}
) {
  const partners =
    await prisma.donorOrganisation.findMany({
      include: {
        engagements: true,
      },
      orderBy: {
        name: "asc",
      },
    });

  const query =
    filters.query?.trim().toLowerCase() ??
    "";

  return partners
    .map(mapPartner)
    .filter((partner) => {
      const matchesQuery =
        !query ||
        [
          partner.name,
          partner.type,
          partner.contactPerson,
          partner.focusAreas.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesType =
        !filters.type ||
        filters.type === "All" ||
        partner.type === filters.type;

      return matchesQuery && matchesType;
    });
}

export async function resolvePartnerDbId(
  partnerIdOrSlug: string
) {
  const organisation =
    await prisma.donorOrganisation.findFirst({
      where: {
        OR: [
          {
            id: partnerIdOrSlug,
          },
          {
            slug: partnerIdOrSlug,
          },
        ],
      },
      select: {
        id: true,
      },
    });

  return organisation?.id ?? null;
}

export async function listPartnershipRequestsFromDb(
  partnerOrganisationIds?: string[],
  centreIds?: string[]
) {
  const requests =
    await prisma.partnershipRequest.findMany({
      where: {
        donorOrganisationId:
          partnerOrganisationIds?.length
            ? {
                in: partnerOrganisationIds,
              }
            : undefined,
        centreId: centreIds?.length
          ? {
              in: centreIds,
            }
          : undefined,
      },
      include: {
        donor: true,
        project: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  return requests.map(mapRequest);
}

export async function listPartnerMessagesFromDb(
  partnerOrganisationIds?: string[]
) {
  const threads =
    await prisma.messageThread.findMany({
      where: {
        donorOrganisationId:
          partnerOrganisationIds?.length
            ? {
                in: partnerOrganisationIds,
              }
            : undefined,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

  return threads.map(
    (thread): PartnerMessage => ({
      id: thread.id,
      from:
        thread.messages[0]?.senderType ===
        "CENTRE"
          ? "Centre"
          : thread.messages[0]
                ?.senderType === "DONOR"
            ? "Donor"
            : "ECDLink",
      subject: thread.subject,
      preview:
        thread.messages[0]?.body ??
        "Secure conversation placeholder.",
      createdAt: dateValue(thread.createdAt),
    })
  );
}

export async function getDonorReportsFromDb(
  scope: {
    partnerOrganisationIds?: string[];
    centreIds?: string[];
  } = {}
): Promise<DonorReport> {
  const partnerScope =
    scope.partnerOrganisationIds?.length
      ? {
          in: scope.partnerOrganisationIds,
        }
      : undefined;

  const centreScope =
    scope.centreIds?.length
      ? {
          in: scope.centreIds,
        }
      : undefined;

  const [
    centreRows,
    projectRows,
    partnerRows,
    requests,
    commitments,
    engagements,
    reports,
  ] = await Promise.all([
    prisma.ecdCentre.findMany({
      where: {
        archivedAt: null,
        id: centreScope,
      },
      include: {
        fundingProfiles: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
        impactProjects: {
          where: {
            approvedForPartnerPortal: true,
            archivedAt: null,
          },
          include: {
            needs: true,
          },
        },
      },
      orderBy: {
        centreName: "asc",
      },
    }),
    prisma.impactProject.findMany({
      where: {
        approvedForPartnerPortal: true,
        archivedAt: null,
        centreId: centreScope,
      },
      include: {
        centre: true,
        needs: true,
      },
      orderBy: [
        {
          featured: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    }),
    prisma.donorOrganisation.findMany({
      where: {
        id: partnerScope,
      },
      include: {
        engagements: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.partnershipRequest.findMany({
      where: {
        donorOrganisationId:
          partnerScope,
        centreId: centreScope,
      },
    }),
    prisma.sponsorshipCommitment.findMany({
      where: {
        donorOrganisationId:
          partnerScope,
        centreId: centreScope,
      },
    }),
    prisma.partnerEngagement.findMany({
      where: {
        donorOrganisationId:
          partnerScope,
        centreId: centreScope,
      },
      include: {
        centre: true,
        project: true,
        donor: true,
      },
    }),
    prisma.impactReport.findMany({
      where: {
        donorOrganisationId:
          partnerScope,
        centreId: centreScope,
      },
    }),
  ]);

  void requests;
  void reports;

  const centres = centreRows.map(mapCentre);
  const projects = projectRows.map(mapProject);
  const partners = partnerRows.map(mapPartner);

  const projectCategories: ProjectCategory[] =
    Array.from(
      new Set<ProjectCategory>(
        projects.map(
          (project) => project.category
        )
      )
    );

  const provinces = Array.from(
    new Set(
      centres.map(
        (centre) => centre.province
      )
    )
  );

  const totalImpact =
    commitments.reduce(
      (sum, item) =>
        sum +
        numberValue(item.committedAmount),
      0
    ) ||
    projects.reduce(
      (sum, project) =>
        sum + project.budget,
      0
    );

  return {
    totalVerifiedCentres: centres.length,
    centresNeedingSupport:
      centres.filter(
        (centre) =>
          centre.activeProjectCount > 0
      ).length,
    activeProjects:
      projects.filter((project) =>
        ["Active", "Featured"].includes(
          project.status
        )
      ).length,
    totalImpact,
    childrenReached:
      centres.reduce(
        (sum, centre) =>
          sum + centre.children,
        0
      ),
    topViewedCentres: centres
      .slice(0, 8)
      .map((centre) => ({
        label: centre.name,
        value:
          engagements.filter(
            (engagement) =>
              engagement.centre?.slug ===
              centre.id
          ).length || 100,
      })),
    mostFundedCategories:
      projectCategories.map((category) => ({
        label: category,
        value:
          projects.filter(
            (project) =>
              project.category ===
              category
          ).length,
      })),
    projectsByProvince:
      provinces.map((province) => ({
        label: province,
        value:
          projects.filter(
            (project) =>
              project.province === province
          ).length,
      })),
    fundingPipeline: projects
      .slice(0, 8)
      .map((project) => ({
        label: project.category,
        value: project.budget,
      })),
    corporateEngagement:
      partners
        .filter(
          (partner) =>
            partner.type.includes("CSI") ||
            partner.type.includes(
              "Corporate"
            )
        )
        .map((partner) => ({
          label: partner.name,
          value: partner.engagementScore,
        })),
  };
}