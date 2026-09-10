import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { assertGrantBankImportCapacity, expectedGrantBankStatementMonths, grantBankImportMatchesContext, isEditableGrantBankImportStatus, isGrantBankImportReportType } from "./bank-import";
import { assertGrantBankReportEligibility, canStartGrantBankStatementExtraction, createOrResumeGrantBankImport } from "@/lib/services/grant-bank-imports";
import { findGrantBankStatementForAccess, grantBankImportIdentitySelect, grantBankImportInclude, grantBankStatementAccessSelect } from "@/lib/repositories/grant-bank-imports";
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
    "app/api/grant-reports/[reportId]/bank-import/[importId]/statements/[statementId]/extract/route.ts",
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

test("an existing report resolves a lightweight bank import before hydrating its Phase 2A workspace", () => {
  const source = readFileSync("lib/services/grant-bank-imports.ts", "utf8");
  const repository = readFileSync("lib/repositories/grant-bank-imports.ts", "utf8");
  const confirmedLookup = source.indexOf("findConfirmedGrantBankImport(tx, lookup)");
  const editableLookup = source.indexOf("findEditableGrantBankImport(tx, lookup)");
  const create = source.indexOf("tx.grantBankImportBatch.create(");
  const transactionEnd = source.indexOf("}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });", create);
  const workspaceHydration = source.indexOf("findGrantBankImport(client, reportId, resolved.batchId)", transactionEnd);
  assert.ok(confirmedLookup >= 0 && editableLookup > confirmedLookup && create > editableLookup);
  assert.ok(transactionEnd > create && workspaceHydration > transactionEnd);
  assert.equal(source.match(/tx\.grantBankImportBatch\.create\(/g)?.length, 1);
  assert.ok((source.match(/TransactionIsolationLevel\.Serializable/g)?.length ?? 0) >= 2);
  assert.match(source, /createOrResumeGrantBankImport[\s\S]*TransactionIsolationLevel\.Serializable, timeout: 15_000/);
  assert.match(repository, /findConfirmedGrantBankImport[\s\S]*select: grantBankImportIdentitySelect/);
  assert.match(repository, /findEditableGrantBankImport[\s\S]*select: grantBankImportIdentitySelect/);
});

test("the real start/open service reopens an existing quarterly import and hydrates after the transaction", async () => {
  const period = { financialYear: "2026", quarter: 1, reportingPeriodStart: new Date("2026-04-01"), reportingPeriodEnd: new Date("2026-06-30") };
  const award = { id: "award-1", centreId: "centre-1", awardNumber: "AW-1", title: "Funding", currency: "ZAR", centre: { centreName: "Test Centre" } };
  const identity = { id: "import-1", originatingGrantReportId: "report-1", grantAwardId: award.id, centreId: award.centreId, financialYear: period.financialYear, quarter: period.quarter };
  let transactionActive = false;
  let hydrated = false;
  const transaction = {
    user: { findFirst: async () => ({ id: "admin-1" }) },
    grantReport: { findUnique: async () => ({ id: "report-1", status: "DRAFT", currentVersionNumber: 1, award, obligation: period }) },
    grantReportVersion: { findUnique: async () => ({ id: "version-1", status: "DRAFT", reportType: "QUARTERLY_CASH_FLOW", currency: "ZAR", ...period }) },
    grantBankImportBatch: {
      findFirst: async (args: { where: { status: unknown }; select: unknown }) => {
        assert.deepEqual(args.select, grantBankImportIdentitySelect);
        return args.where.status === "CONFIRMED" ? null : identity;
      },
      create: async () => { throw new Error("An existing import must not be recreated."); },
    },
  };
  const client = {
    $transaction: async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, options: { timeout: number; isolationLevel: string }) => {
      assert.equal(options.timeout, 15_000);
      assert.equal(options.isolationLevel, Prisma.TransactionIsolationLevel.Serializable);
      transactionActive = true;
      // Only the Prisma methods reached by this service are implemented by this fixture.
      try { return await operation(transaction as unknown as Prisma.TransactionClient); }
      finally { transactionActive = false; }
    },
    grantBankImportBatch: { findFirst: async (args: { where: unknown; include: unknown }) => {
      assert.equal(transactionActive, false);
      assert.deepEqual(args.where, { id: identity.id, originatingGrantReportId: "report-1" });
      assert.deepEqual(args.include, grantBankImportInclude);
      hydrated = true;
      return { ...identity, ...period, award, currency: "ZAR", status: "UPLOADING", statements: [] };
    } },
  };
  const result = await createOrResumeGrantBankImport("report-1", "admin-1", client as unknown as Parameters<typeof createOrResumeGrantBankImport>[2]);
  assert.equal(result.id, identity.id);
  assert.equal(result.reportType, "QUARTERLY_CASH_FLOW");
  assert.equal(result.editable, true);
  assert.deepEqual(result.statements, []);
  assert.equal(hydrated, true);
});

test("the destination workspace keeps authorization and alignment without a read-only transaction timeout", () => {
  const source = readFileSync("lib/services/grant-bank-imports.ts", "utf8");
  const loader = source.slice(source.indexOf("export async function getGrantBankImportWorkspace"), source.indexOf("function metadataData"));
  assert.match(loader, /requireActorAndContext\(prisma, input\.actorUserId, input\.reportId\)/);
  assert.match(loader, /findGrantBankImport\(prisma, input\.reportId, input\.importId\)/);
  assert.match(loader, /assertGrantBankImportAlignment\(batch, context\)/);
  assert.doesNotMatch(loader, /\$transaction/);
});

test("signed statement access is scoped through a bounded report, import and statement lookup before storage access", async () => {
  const source = readFileSync("lib/services/grant-bank-imports.ts", "utf8");
  assert.match(source, /loadStatementFile\(input\)/);
  assert.match(source, /requireActorAndContext\(prisma, input\.actorUserId, input\.reportId\)/);
  assert.match(source, /findGrantBankStatementForAccess\(prisma, input\)/);
  assert.match(source, /assertGrantBankImportAlignment\(statement\.batch, context\)/);
  const calls: unknown[] = [];
  const result = await findGrantBankStatementForAccess({
    grantBankStatement: {
      findFirst: async (args: unknown) => {
        calls.push(args);
        return { id: "statement-1", fileAssetId: "file-1", batch: { id: "import-1" } };
      },
    },
  } as unknown as Parameters<typeof findGrantBankStatementForAccess>[0], {
    reportId: "report-1",
    importId: "import-1",
    statementId: "statement-1",
  });
  assert.equal(result?.fileAssetId, "file-1");
  assert.deepEqual(calls, [{
    where: {
      id: "statement-1",
      batchId: "import-1",
      batch: { originatingGrantReportId: "report-1" },
    },
    select: grantBankStatementAccessSelect,
  }]);
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

test("extraction persists normalized rows and processing audit state without categorisation", () => {
  const source = readFileSync("lib/services/grant-bank-imports.ts", "utf8");
  assert.match(source, /grantBankProcessingAttempt\.create/);
  assert.match(source, /grantBankTransaction\.createMany/);
  assert.match(source, /transactionFingerprint: bankTransactionFingerprint/);
  assert.match(source, /extractionStatus: result\.state === "EXTRACTED" \? "EXTRACTED" : "NEEDS_REVIEW"/);
  assert.doesNotMatch(source, /suggestedType:|suggestedCategory:|confirmedType:|confirmedCategory:/);
  assert.match(source, /actorUserId: input\.actorUserId, action: "grant\.bank_statement\.extraction\.started"/);
  assert.match(source, /extractGrantBankStatement[\s\S]*TransactionIsolationLevel\.Serializable, timeout: 15_000/);
});

test("a no-transactions parser result can be retried after parser support improves without duplicating rows", () => {
  assert.equal(canStartGrantBankStatementExtraction({ extractionStatus: "NEEDS_REVIEW", transactionCount: 0, latestSafeFailureCode: "no_transactions_detected" }), true);
  assert.equal(canStartGrantBankStatementExtraction({ extractionStatus: "NEEDS_REVIEW", transactionCount: 0, latestSafeFailureCode: "ocr_required" }), false);
  assert.equal(canStartGrantBankStatementExtraction({ extractionStatus: "NEEDS_REVIEW", transactionCount: 1, latestSafeFailureCode: "no_transactions_detected" }), false);
});
