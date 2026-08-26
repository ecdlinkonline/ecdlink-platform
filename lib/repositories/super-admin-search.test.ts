import assert from "node:assert/strict";
import test from "node:test";
import {
  searchSuperAdminWorkspace,
  type SuperAdminSearchQueryExecutor,
  type SuperAdminSearchQueryPlan,
  type SuperAdminSearchRows
} from "./super-admin-search";

const emptyRows: SuperAdminSearchRows = {
  centres: [],
  memberships: [],
  orders: [],
  suppliers: [],
  partners: [],
  applications: [],
  fundingCalls: [],
  complianceDocuments: []
};

function executorFor(rows: Partial<SuperAdminSearchRows>, plans: SuperAdminSearchQueryPlan[] = []): SuperAdminSearchQueryExecutor {
  return async (queries) => {
    plans.push(queries);
    return { ...emptyRows, ...rows };
  };
}

test("actual repository search builds bounded centre and supplier Prisma queries", async () => {
  const plans: SuperAdminSearchQueryPlan[] = [];
  await searchSuperAdminWorkspace("bright", executorFor({}, plans));
  const plan = plans[0];
  assert.ok(plan);

  assert.deepEqual(plan.centres.where.OR.map((condition) => Object.keys(condition)[0]), ["centreName", "principalName", "area", "region", "province", "npoNumber"]);
  assert.deepEqual(plan.suppliers.where.OR.map((condition) => Object.keys(condition)[0]), ["companyName", "registrationNumber", "contactPerson", "city", "province", "email"]);

  for (const query of Object.values(plan)) assert.equal(query.take, 4);
  assert.deepEqual(Object.keys(plan.centres.select).sort(), ["area", "centreName", "id", "npoNumber", "principalName", "province", "region", "slug"]);
  assert.deepEqual(Object.keys(plan.suppliers.select).sort(), ["city", "companyName", "contactPerson", "id", "province", "registrationNumber", "slug"]);
  assert.equal("email" in plan.suppliers.select, false);
  assert.equal("notes" in plan.centres.select, false);
});

test("actual repository search maps centre, supplier and module hrefs from mocked Prisma rows", async () => {
  const results = await searchSuperAdminWorkspace("bright", executorFor({
    centres: [{ id: "centre-1", slug: "bright-centre", centreName: "Bright Centre", principalName: "Nandi", area: "Soweto", region: "Johannesburg", province: "Gauteng", npoNumber: "123" }],
    memberships: [{ id: "membership-1", membershipYear: 2026, status: "ACTIVE", paymentStatus: "PAID", centre: { centreName: "Bright Centre" } }],
    orders: [{ id: "order-1", orderNumber: "ORD-001", status: "SUBMITTED", centre: { centreName: "Bright Centre" }, supplier: { companyName: "Bright Supplies" } }],
    suppliers: [{ id: "supplier-1", slug: "bright-supplies", companyName: "Bright Supplies", contactPerson: "Alex", city: "Cape Town", province: "Western Cape", registrationNumber: "REG-1" }],
    applications: [{ id: "application-1", applicationNumber: "APP-1", status: "SUBMITTED", project: { title: "Bright Project", profile: { centre: { centreName: "Bright Centre", slug: "bright-centre" } } }, fundingCall: { title: "Bright Call" }, fundingOrganisation: { name: "Bright Funder" } }],
    complianceDocuments: [{ id: "document-1", documentType: "NPO Certificate", documentNumber: "DOC-1", verificationStatus: "PENDING_REVIEW", centre: { centreName: "Bright Centre" }, requirement: { name: "NPO Registration" } }]
  }));

  const hrefById = new Map(results.map((result) => [result.id, result.href]));
  assert.equal(hrefById.get("centre-centre-1"), "/dashboard/super-admin/centres/bright-centre");
  assert.equal(hrefById.get("supplier-supplier-1"), "/dashboard/super-admin/suppliers/bright-supplies");
  assert.equal(hrefById.get("membership-membership-1"), "/dashboard/super-admin/memberships");
  assert.equal(hrefById.get("procurement-order-1"), "/dashboard/super-admin/procurement");
  assert.equal(hrefById.get("funding-application-application-1"), "/dashboard/super-admin/funding/bright-centre");
  assert.equal(hrefById.get("compliance-document-1"), "/dashboard/super-admin/compliance");
});

test("a genuine no-match repository response produces no results", async () => {
  assert.deepEqual(await searchSuperAdminWorkspace("no-such-record-or-module", executorFor({})), []);
});
