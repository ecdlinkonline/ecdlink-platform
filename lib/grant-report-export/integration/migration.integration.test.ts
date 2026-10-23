import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { createGeneratingArtifactFixture, createQueuedExportRequestFixture, createSubmittedReportFixture } from "./fixture-factory";
import { databaseIntegrationTest, uniqueTestId, withIntegrationClient } from "./integration-test-context";

const C2B1_MIGRATION = "20261012120000_grant_report_export_artifacts";
const OUTBOX_MIGRATION = "20261013120000_grant_report_export_outbox";
const stage = process.env.ECDLINK_INTEGRATION_MIGRATION_STAGE;

databaseIntegrationTest("committed migrations are recorded in the expected order", async () => {
  await withIntegrationClient(async (client) => {
    const rows = await client.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>(Prisma.sql`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at, migration_name
    `);
    const names = rows.map((row) => row.migration_name);
    const artifactIndex = names.indexOf(C2B1_MIGRATION);
    assert.ok(artifactIndex >= 0);
    if (stage === "A") assert.equal(names.includes(OUTBOX_MIGRATION), false);
    if (stage === "B" || stage === "C") assert.ok(names.indexOf(OUTBOX_MIGRATION) > artifactIndex);
    assert.equal(rows.some((row) => row.finished_at === null || row.rolled_back_at !== null), false);
  });
});

databaseIntegrationTest("export tables, enums, indexes, constraints, and triggers match the migration stage", async () => {
  await withIntegrationClient(async (client) => {
    const relations = await client.$queryRaw<Array<{ name: string }>>(Prisma.sql`
      SELECT c.relname AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('GrantReportExportArtifact', 'GrantReportExportAttempt', 'GrantReportExportRequest')
    `);
    const names = new Set(relations.map((row) => row.name));
    assert.equal(names.has("GrantReportExportArtifact"), true);
    assert.equal(names.has("GrantReportExportAttempt"), true);
    assert.equal(names.has("GrantReportExportRequest"), stage !== "A");

    const triggers = await client.$queryRaw<Array<{ name: string }>>(Prisma.sql`
      SELECT tgname AS name FROM pg_trigger
      WHERE NOT tgisinternal AND tgname LIKE 'GrantReportExport%'
    `);
    const triggerNames = new Set(triggers.map((row) => row.name));
    assert.equal(triggerNames.has("GrantReportExportArtifact_completed_immutable"), true);
    assert.equal(triggerNames.has("GrantReportExportAttempt_completed_immutable"), true);
    assert.equal(triggerNames.has("GrantReportExportRequest_integrity"), stage !== "A");

    if (stage !== "A") {
      const indexes = await client.$queryRaw<Array<{ indexdef: string }>>(Prisma.sql`
        SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'GrantReportExportRequest_active_version_format_key'
      `);
      assert.equal(indexes.length, 1);
      assert.match(indexes[0].indexdef, /UNIQUE/);
      assert.match(indexes[0].indexdef, /WHERE.*QUEUED.*DISPATCHING.*DISPATCHED/i);
    }
  });
});

databaseIntegrationTest("composite ownership foreign keys and CHECK constraints are installed", async () => {
  await withIntegrationClient(async (client) => {
    const constraints = await client.$queryRaw<Array<{ name: string; definition: string }>>(Prisma.sql`
      SELECT conname AS name, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname LIKE 'GrantReportExport%'
      ORDER BY conname
    `);
    const byName = new Map(constraints.map((item) => [item.name, item.definition]));
    assert.match(byName.get("GrantReportExportArtifact_version_fkey") ?? "", /FOREIGN KEY \("grantReportVersionId", "grantReportId"\)/);
    assert.ok(byName.has("GrantReportExportArtifact_completion_check"));
    assert.ok(byName.has("GrantReportExportAttempt_cleanup_state_check"));
    if (stage !== "A") {
      assert.match(byName.get("GrantReportExportRequest_artifact_fkey") ?? "", /FOREIGN KEY \("artifactId", "grantReportVersionId", "grantReportId", format\)/);
      assert.ok(byName.has("GrantReportExportRequest_state_check"));
    }
  });
});

databaseIntegrationTest("completed artifacts are immutable while integrity verification fields remain operational", async () => {
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("migration-artifact-immutability"));
    const artifactId = await createGeneratingArtifactFixture(client, fixture);
    const fileId = `${fixture.prefix}_completed_file`;
    await client.fileAsset.create({ data: { id: fileId, storageProvider: "supabase", storageKey: `${fixture.prefix}/pack.zip`, originalFilename: "pack.zip", mimeType: "application/zip", fileSize: 100, checksum: "a".repeat(64), uploadedByUserId: fixture.adminUserId } });
    await client.grantReportExportArtifact.update({
      where: { id: artifactId },
      data: { status: "COMPLETED", integrityStatus: "VERIFIED", latestAttemptNumber: 1, completedFileAssetId: fileId, sha256: "a".repeat(64), byteSize: 100, manifestSchemaVersion: 1, completedByUserId: fixture.adminUserId, completedAt: new Date(), lastIntegrityVerifiedAt: new Date() },
    });
    await assert.rejects(() => client.grantReportExportArtifact.update({ where: { id: artifactId }, data: { byteSize: 101 } }));
    await assert.rejects(() => client.grantReportExportArtifact.delete({ where: { id: artifactId } }));
    await client.grantReportExportArtifact.update({ where: { id: artifactId }, data: { integrityStatus: "UNAVAILABLE", lastIntegrityVerifiedAt: new Date() } });
  });
});

databaseIntegrationTest("terminal request immutability, invalid transitions, and audit rollback are enforced", async () => {
  if (stage === "A") return;
  await withIntegrationClient(async (client) => {
    const fixture = await createSubmittedReportFixture(client, uniqueTestId("migration-request-integrity"));
    const requestId = await createQueuedExportRequestFixture(client, fixture);
    await assert.rejects(() => client.grantReportExportRequest.update({ where: { id: requestId }, data: { status: "COMPLETED" } }));

    const token = "b".repeat(64);
    await client.grantReportExportRequest.update({ where: { id: requestId }, data: { status: "DISPATCHING", dispatchAttemptCount: 1, dispatchToken: token, dispatchLeaseExpiresAt: new Date(Date.now() + 60_000) } });
    await client.grantReportExportRequest.update({ where: { id: requestId }, data: { status: "FAILED", dispatchToken: null, dispatchLeaseExpiresAt: null, failedAt: new Date(), lastSafeFailureCode: "QUEUE_UNAVAILABLE" } });
    await assert.rejects(() => client.grantReportExportRequest.update({ where: { id: requestId }, data: { lastSafeFailureCode: "DISPATCH_FAILED" } }));
    await assert.rejects(() => client.grantReportExportRequest.delete({ where: { id: requestId } }));

    const auditAction = `${fixture.prefix}.must_rollback`;
    await assert.rejects(() => client.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { actorUserId: fixture.adminUserId, action: auditAction, entityType: "GrantReportExportRequest", entityId: requestId } });
      await tx.grantReportExportRequest.update({ where: { id: requestId }, data: { status: "QUEUED" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    assert.equal(await client.auditLog.count({ where: { action: auditAction } }), 0);
  });
});
