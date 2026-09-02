import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertGrantBankImportCapacity, expectedGrantBankStatementMonths, grantBankImportMatchesContext, isEditableGrantBankImportStatus, isGrantBankImportReportType } from "./bank-import";
import { assertGrantBankReportEligibility } from "@/lib/services/grant-bank-imports";
import { grantBankStatementMetadataSchema } from "@/lib/validators/grant-bank-imports";
import { defaultDocumentPolicy, validateStorageFile } from "@/lib/storage/validation";

test("bank imports are limited to the two quarterly report types", () => {
  assert.equal(isGrantBankImportReportType("QUARTERLY_EXPENDITURE"), true);
  assert.equal(isGrantBankImportReportType("QUARTERLY_CASH_FLOW"), true);
  for (const type of ["INTERIM", "FINAL", "CUSTOM"]) assert.equal(isGrantBankImportReportType(type), false);
});

test("the service blocks non-quarterly reports", () => {
  assert.throws(
    () => assertGrantBankReportEligibility({ reportType: "FINAL", reportStatus: "DRAFT", versionStatus: "DRAFT" }, true),
    /only for Quarterly Expenditure and Quarterly Cash Flow/,
  );
});

test("expected statement months derive from the saved reporting period rather than a hard-coded quarter", () => {
  assert.deepEqual(expectedGrantBankStatementMonths("2026-04-01", "2026-06-30"), [
    { value: "2026-04-01", label: "April 2026" },
    { value: "2026-05-01", label: "May 2026" },
    { value: "2026-06-01", label: "June 2026" },
  ]);
});

test("batch alignment requires the same report, award, centre, financial year and quarter", () => {
  const batch = { originatingGrantReportId: "report-1", grantAwardId: "award-1", centreId: "centre-1", financialYear: "2026", quarter: 1 };
  const context = { reportId: "report-1", grantAwardId: "award-1", centreId: "centre-1", financialYear: "2026", quarter: 1 };
  assert.equal(grantBankImportMatchesContext(batch, context), true);
  assert.equal(grantBankImportMatchesContext(batch, { ...context, centreId: "centre-2" }), false);
  assert.equal(grantBankImportMatchesContext(batch, { ...context, grantAwardId: "award-2" }), false);
});

test("a fourth statement is blocked while replacement preserves the three-slot limit", () => {
  assert.throws(() => assertGrantBankImportCapacity(3), /already has three/);
  assert.doesNotThrow(() => assertGrantBankImportCapacity(3, true));
});

test("confirmed and archived batches are not editable", () => {
  assert.equal(isEditableGrantBankImportStatus("UPLOADING"), true);
  assert.equal(isEditableGrantBankImportStatus("CONFIRMED"), false);
  assert.equal(isEditableGrantBankImportStatus("ARCHIVED"), false);
});

test("manual metadata accepts optional values but rejects full account numbers and reversed periods", () => {
  const valid = { statementMonth: "2026-04-01", periodStart: "", periodEnd: "", statementDate: "", bankName: "FNB", accountHolderName: "Future Leaders", maskedAccountReference: "****1234", openingBalance: "1000.00", closingBalance: "800.00", currency: "ZAR" };
  assert.equal(grantBankStatementMetadataSchema.safeParse(valid).success, true);
  assert.equal(grantBankStatementMetadataSchema.safeParse({ ...valid, openingBalance: "-250.50" }).success, true);
  assert.equal(grantBankStatementMetadataSchema.safeParse({ ...valid, maskedAccountReference: "1234567890" }).success, false);
  assert.equal(grantBankStatementMetadataSchema.safeParse({ ...valid, periodStart: "2026-04-30", periodEnd: "2026-04-01" }).success, false);
});

test("bank statement policy supports PDF, PNG and JPEG and rejects unrelated content", async () => {
  assert.deepEqual(defaultDocumentPolicy.allowedMimeTypes, ["application/pdf", "image/jpeg", "image/png"]);
  await assert.rejects(() => validateStorageFile({ name: "statement.txt", type: "text/plain", size: 4, arrayBuffer: async () => new TextEncoder().encode("text").buffer }));
});

test("all bank-import API routes use database-backed report admin authorization", () => {
  const paths = [
    "app/api/grant-reports/[reportId]/bank-import/route.ts",
    "app/api/grant-reports/[reportId]/bank-import/[importId]/route.ts",
    "app/api/grant-reports/[reportId]/bank-import/[importId]/statements/route.ts",
    "app/api/grant-reports/[reportId]/bank-import/[importId]/statements/[statementId]/route.ts",
    "app/api/grant-reports/[reportId]/bank-import/[importId]/statements/[statementId]/file/route.ts",
  ];
  const auth = readFileSync("lib/api/report-auth.ts", "utf8");
  assert.match(auth, /requireIdentityAdmin\(\)/);
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /requireReportAdmin\(\)/);
    assert.doesNotMatch(source, /unsafeMetadata|publicMetadata|requireFundingOrganisation/);
  }
});

test("upload uses private FileAsset storage and rolls a new file back if database persistence fails", () => {
  const source = readFileSync("lib/services/grant-bank-imports.ts", "utf8");
  assert.match(source, /storage\.uploadFileAsset\(\{[\s\S]*module: "funding"[\s\S]*entityId: input\.importId/);
  assert.match(source, /catch \(error\)[\s\S]*storage\.rollbackStagedFileAsset\(\{ fileAssetId: file\.id/);
  assert.match(source, /action: current \? "grant\.bank_statement\.replaced" : "grant\.bank_statement\.uploaded"/);
});

test("create or resume resolves confirmed or editable batches before creating a new active batch", () => {
  const source = readFileSync("lib/services/grant-bank-imports.ts", "utf8");
  const confirmedLookup = source.indexOf("findConfirmedGrantBankImport(tx, lookup)");
  const editableLookup = source.indexOf("findEditableGrantBankImport(tx, lookup)");
  const create = source.indexOf("tx.grantBankImportBatch.create(");
  assert.ok(confirmedLookup >= 0 && editableLookup > confirmedLookup && create > editableLookup);
  assert.equal(source.match(/tx\.grantBankImportBatch\.create\(/g)?.length, 1);
  assert.ok((source.match(/TransactionIsolationLevel\.Serializable/g)?.length ?? 0) >= 2);
});

test("signed statement access is scoped through report, import and statement before storage access", () => {
  const source = readFileSync("lib/services/grant-bank-imports.ts", "utf8");
  assert.match(source, /loadStatementFile\(input\)/);
  assert.match(source, /findGrantBankImport\(tx, input\.reportId, input\.importId\)/);
  assert.match(source, /batch\.statements\.find\(\(item\) => item\.id === input\.statementId\)/);
  assert.match(source, /storage\.createPreviewAccess/);
  assert.match(source, /storage\.createDownloadAccess/);
});

test("statement mutation guards block processed children and preserve internal audit actors", () => {
  const source = readFileSync("lib/services/grant-bank-imports.ts", "utf8");
  const repository = readFileSync("lib/repositories/grant-bank-imports.ts", "utf8");
  assert.match(source, /_count\.transactions > 0/);
  assert.match(source, /_count\.processingAttempts > 0/);
  assert.match(source, /actorUserId: input\.actorUserId, action: "grant\.bank_statement\.removed"/);
  assert.match(repository, /role: "SUPER_ADMIN", status: "ACTIVE"/);
});

test("editable statement metadata and removal remain transactional and confirmed or archived batches are blocked", () => {
  const source = readFileSync("lib/services/grant-bank-imports.ts", "utf8");
  assert.match(source, /updateGrantBankStatementMetadata[\s\S]*prisma\.\$transaction/);
  assert.match(source, /removeGrantBankStatement[\s\S]*prisma\.\$transaction/);
  assert.match(source, /assertEditableBatch\(batch, context\)/);
  assert.equal(isEditableGrantBankImportStatus("CONFIRMED"), false);
  assert.equal(isEditableGrantBankImportStatus("ARCHIVED"), false);
});

test("manual quarterly report save paths remain intact beside the bank-import entry action", () => {
  for (const path of ["components/reports/dbe-quarterly-expenditure-editor.tsx", "components/reports/dbe-quarterly-cash-flow-editor.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /BankStatementImportAction/);
    assert.match(source, /\/sections/);
    assert.match(source, /Save Draft/);
  }
});
