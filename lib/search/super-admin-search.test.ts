import assert from "node:assert/strict";
import test from "node:test";
import { hasAuthoritativeRole } from "@/lib/auth/authorization";
import {
  buildCentreSearchResult,
  buildModuleShortcutResults,
  buildSupplierSearchResult,
  limitResultsPerModule
} from "@/lib/search/super-admin-search";
import { superAdminSearchQuerySchema } from "@/lib/validators/super-admin-search";

test("active database Super Admin access is allowed and non-admin access is denied", () => {
  assert.equal(hasAuthoritativeRole({ role: "SUPER_ADMIN", status: "ACTIVE" }, "super_admin"), true);
  assert.equal(hasAuthoritativeRole({ role: "ECD_CENTRE", status: "ACTIVE" }, "super_admin"), false);
  assert.equal(hasAuthoritativeRole({ role: "SUPER_ADMIN", status: "SUSPENDED" }, "super_admin"), false);
});

test("search query validation trims bounded queries and rejects empty or oversized input", () => {
  assert.equal(superAdminSearchQuerySchema.parse({ q: "  bright futures  " }).q, "bright futures");
  assert.equal(superAdminSearchQuerySchema.safeParse({ q: "" }).success, false);
  assert.equal(superAdminSearchQuerySchema.safeParse({ q: "a" }).success, false);
  assert.equal(superAdminSearchQuerySchema.safeParse({ q: "x".repeat(101) }).success, false);
});

test("centre search results use the existing centre detail route", () => {
  const result = buildCentreSearchResult({
    id: "centre-1",
    slug: "bright-futures-kids",
    centreName: "Bright Futures Kids",
    principalName: "Nandi Dube",
    area: "Soweto",
    region: "Johannesburg",
    province: "Gauteng",
    npoNumber: "123-456"
  });

  assert.equal(result.module, "centres");
  assert.equal(result.title, "Bright Futures Kids");
  assert.equal(result.href, "/dashboard/super-admin/centres/bright-futures-kids");
  assert.match(result.context, /NPO 123-456/);
});

test("non-centre results use the existing supplier detail route", () => {
  const result = buildSupplierSearchResult({
    id: "supplier-1",
    slug: "learning-supplies",
    companyName: "Learning Supplies",
    contactPerson: "Thandi Mokoena",
    city: "Pretoria",
    province: "Gauteng",
    registrationNumber: "2024/001"
  });

  assert.equal(result.module, "suppliers");
  assert.equal(result.href, "/dashboard/super-admin/suppliers/learning-supplies");
});

test("workspace shortcuts cover reports and intelligence with valid navigation targets", () => {
  assert.equal(buildModuleShortcutResults("reports")[0]?.href, "/dashboard/super-admin/reports");
  assert.equal(buildModuleShortcutResults("intelligence")[0]?.href, "/dashboard/super-admin/intelligence");
});

test("empty and unmatched queries return no shortcut results", () => {
  assert.deepEqual(buildModuleShortcutResults(""), []);
  assert.deepEqual(buildModuleShortcutResults("no-such-workspace-module"), []);
  assert.deepEqual(limitResultsPerModule([], 4), []);
});

test("module result limits keep global search bounded", () => {
  const supplier = buildSupplierSearchResult({
    id: "supplier-1",
    slug: "supplier-1",
    companyName: "Supplier One",
    contactPerson: null,
    city: null,
    province: null,
    registrationNumber: null
  });
  const results = Array.from({ length: 8 }, (_, index) => ({ ...supplier, id: `supplier-${index}` }));
  assert.equal(limitResultsPerModule(results, 4).length, 4);
});
