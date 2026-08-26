import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  buildCentreSearchResult,
  buildModuleShortcutResults,
  buildSupplierSearchResult,
  limitResultsPerModule,
  moduleLabel,
  type SuperAdminSearchResult
} from "@/lib/search/super-admin-search";

const RESULTS_PER_MODULE = 4;

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function buildSuperAdminSearchQueries(query: string) {
  return {
    centres: {
      where: {
        archivedAt: null,
        OR: [
          { centreName: { contains: query, mode: "insensitive" } },
          { principalName: { contains: query, mode: "insensitive" } },
          { area: { contains: query, mode: "insensitive" } },
          { region: { contains: query, mode: "insensitive" } },
          { province: { contains: query, mode: "insensitive" } },
          { npoNumber: { contains: query, mode: "insensitive" } }
        ]
      },
      select: { id: true, slug: true, centreName: true, principalName: true, area: true, region: true, province: true, npoNumber: true },
      orderBy: { centreName: "asc" },
      take: RESULTS_PER_MODULE
    } satisfies Prisma.EcdCentreFindManyArgs,
    memberships: {
      where: {
        centre: { archivedAt: null },
        OR: [
          { centre: { centreName: { contains: query, mode: "insensitive" } } },
          { centre: { principalName: { contains: query, mode: "insensitive" } } },
          { centre: { area: { contains: query, mode: "insensitive" } } },
          { centre: { region: { contains: query, mode: "insensitive" } } },
          { centre: { npoNumber: { contains: query, mode: "insensitive" } } },
          { invoices: { some: { invoiceNo: { contains: query, mode: "insensitive" } } } }
        ]
      },
      select: { id: true, membershipYear: true, status: true, paymentStatus: true, centre: { select: { centreName: true } } },
      orderBy: [{ membershipYear: "desc" }, { updatedAt: "desc" }],
      take: RESULTS_PER_MODULE
    } satisfies Prisma.MembershipFindManyArgs,
    orders: {
      where: {
        centre: { archivedAt: null },
        OR: [
          { orderNumber: { contains: query, mode: "insensitive" } },
          { centre: { centreName: { contains: query, mode: "insensitive" } } },
          { centre: { area: { contains: query, mode: "insensitive" } } },
          { centre: { region: { contains: query, mode: "insensitive" } } },
          { supplier: { is: { companyName: { contains: query, mode: "insensitive" } } } },
          { items: { some: { supplierNameSnapshot: { contains: query, mode: "insensitive" } } } }
        ]
      },
      select: { id: true, orderNumber: true, status: true, centre: { select: { centreName: true } }, supplier: { select: { companyName: true } } },
      orderBy: { submittedAt: "desc" },
      take: RESULTS_PER_MODULE
    } satisfies Prisma.ProcurementOrderFindManyArgs,
    suppliers: {
      where: {
        archivedAt: null,
        OR: [
          { companyName: { contains: query, mode: "insensitive" } },
          { registrationNumber: { contains: query, mode: "insensitive" } },
          { contactPerson: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
          { province: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } }
        ]
      },
      select: { id: true, slug: true, companyName: true, contactPerson: true, city: true, province: true, registrationNumber: true },
      orderBy: { companyName: "asc" },
      take: RESULTS_PER_MODULE
    } satisfies Prisma.SupplierFindManyArgs,
    partners: {
      where: {
        archivedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { organisationName: { contains: query, mode: "insensitive" } },
          { registrationNumber: { contains: query, mode: "insensitive" } },
          { contactPerson: { contains: query, mode: "insensitive" } },
          { city: { contains: query, mode: "insensitive" } },
          { province: { contains: query, mode: "insensitive" } }
        ]
      },
      select: { id: true, name: true, organisationName: true, type: true, city: true, province: true, status: true },
      orderBy: { name: "asc" },
      take: RESULTS_PER_MODULE
    } satisfies Prisma.DonorOrganisationFindManyArgs,
    applications: {
      where: {
        OR: [
          { applicationNumber: { contains: query, mode: "insensitive" } },
          { externalReference: { contains: query, mode: "insensitive" } },
          { project: { title: { contains: query, mode: "insensitive" } } },
          { project: { profile: { centre: { centreName: { contains: query, mode: "insensitive" } } } } },
          { fundingCall: { is: { title: { contains: query, mode: "insensitive" } } } },
          { fundingOrganisation: { is: { name: { contains: query, mode: "insensitive" } } } }
        ]
      },
      select: {
        id: true,
        applicationNumber: true,
        status: true,
        project: { select: { title: true, profile: { select: { centre: { select: { centreName: true, slug: true } } } } } },
        fundingCall: { select: { title: true } },
        fundingOrganisation: { select: { name: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: RESULTS_PER_MODULE
    } satisfies Prisma.FundingApplicationFindManyArgs,
    fundingCalls: {
      where: {
        archivedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { referenceNumber: { contains: query, mode: "insensitive" } },
          { organisation: { name: { contains: query, mode: "insensitive" } } }
        ]
      },
      select: { id: true, title: true, referenceNumber: true, status: true, organisation: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: RESULTS_PER_MODULE
    } satisfies Prisma.FundingCallFindManyArgs,
    complianceDocuments: {
      where: {
        archivedAt: null,
        OR: [
          { documentNumber: { contains: query, mode: "insensitive" } },
          { documentType: { contains: query, mode: "insensitive" } },
          { centre: { centreName: { contains: query, mode: "insensitive" } } },
          { centre: { principalName: { contains: query, mode: "insensitive" } } },
          { centre: { npoNumber: { contains: query, mode: "insensitive" } } },
          { requirement: { is: { name: { contains: query, mode: "insensitive" } } } },
          { requirement: { is: { code: { contains: query, mode: "insensitive" } } } }
        ]
      },
      select: { id: true, documentType: true, documentNumber: true, verificationStatus: true, centre: { select: { centreName: true } }, requirement: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: RESULTS_PER_MODULE
    } satisfies Prisma.ComplianceDocumentFindManyArgs
  };
}

export type SuperAdminSearchQueryPlan = ReturnType<typeof buildSuperAdminSearchQueries>;

async function executeSuperAdminSearchQueries(queries: SuperAdminSearchQueryPlan) {
  const [centres, memberships, orders, suppliers, partners, applications, fundingCalls, complianceDocuments] = await Promise.all([
    prisma.ecdCentre.findMany(queries.centres),
    prisma.membership.findMany(queries.memberships),
    prisma.procurementOrder.findMany(queries.orders),
    prisma.supplier.findMany(queries.suppliers),
    prisma.donorOrganisation.findMany(queries.partners),
    prisma.fundingApplication.findMany(queries.applications),
    prisma.fundingCall.findMany(queries.fundingCalls),
    prisma.complianceDocument.findMany(queries.complianceDocuments)
  ]);

  return { centres, memberships, orders, suppliers, partners, applications, fundingCalls, complianceDocuments };
}

export type SuperAdminSearchRows = Awaited<ReturnType<typeof executeSuperAdminSearchQueries>>;
export type SuperAdminSearchQueryExecutor = (queries: SuperAdminSearchQueryPlan) => Promise<SuperAdminSearchRows>;

export async function searchSuperAdminWorkspace(
  query: string,
  executeQueries: SuperAdminSearchQueryExecutor = executeSuperAdminSearchQueries
): Promise<SuperAdminSearchResult[]> {
  const { centres, memberships, orders, suppliers, partners, applications, fundingCalls, complianceDocuments } = await executeQueries(
    buildSuperAdminSearchQueries(query)
  );

  const databaseResults: SuperAdminSearchResult[] = [
    ...centres.map(buildCentreSearchResult),
    ...memberships.map((membership) => ({
      id: `membership-${membership.id}`,
      module: "memberships" as const,
      moduleLabel: moduleLabel("memberships"),
      title: membership.centre.centreName,
      context: `${membership.membershipYear} membership · ${humanize(membership.status)} · ${humanize(membership.paymentStatus)}`,
      href: "/dashboard/super-admin/memberships"
    })),
    ...orders.map((order) => ({
      id: `procurement-${order.id}`,
      module: "procurement" as const,
      moduleLabel: moduleLabel("procurement"),
      title: order.orderNumber,
      context: [order.centre.centreName, order.supplier?.companyName, humanize(order.status)].filter(Boolean).join(" · "),
      href: "/dashboard/super-admin/procurement"
    })),
    ...suppliers.map(buildSupplierSearchResult),
    ...partners.map((partner) => ({
      id: `partner-${partner.id}`,
      module: "partners" as const,
      moduleLabel: moduleLabel("partners"),
      title: partner.organisationName ?? partner.name,
      context: [partner.type, partner.city ?? partner.province, partner.status].filter(Boolean).join(" · "),
      href: "/dashboard/super-admin/partners"
    })),
    ...applications.map((application) => ({
      id: `funding-application-${application.id}`,
      module: "funding" as const,
      moduleLabel: moduleLabel("funding"),
      title: application.project.title,
      context: [application.applicationNumber, application.project.profile.centre.centreName, application.fundingOrganisation?.name ?? application.fundingCall?.title, humanize(application.status)].filter(Boolean).join(" · "),
      href: `/dashboard/super-admin/funding/${application.project.profile.centre.slug}`
    })),
    ...fundingCalls.map((call) => ({
      id: `funding-opportunity-${call.id}`,
      module: "funding" as const,
      moduleLabel: moduleLabel("funding"),
      title: call.title,
      context: [call.organisation.name, call.referenceNumber, call.status].filter(Boolean).join(" · "),
      href: "/dashboard/super-admin/funding"
    })),
    ...complianceDocuments.map((document) => ({
      id: `compliance-${document.id}`,
      module: "compliance" as const,
      moduleLabel: moduleLabel("compliance"),
      title: document.requirement?.name ?? document.documentType,
      context: [document.centre.centreName, document.documentNumber, humanize(document.verificationStatus)].filter(Boolean).join(" · "),
      href: "/dashboard/super-admin/compliance"
    }))
  ];

  return limitResultsPerModule([...databaseResults, ...buildModuleShortcutResults(query)], RESULTS_PER_MODULE);
}
