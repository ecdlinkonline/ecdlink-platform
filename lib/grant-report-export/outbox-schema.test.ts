import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const migration = readFileSync(
  join(process.cwd(), "prisma", "migrations", "20261013120000_grant_report_export_outbox", "migration.sql"),
  "utf8",
);

test("the export outbox schema preserves exact report, version, format, and requester ownership", () => {
  assert.match(schema, /enum GrantReportExportRequestStatus \{\s+QUEUED\s+DISPATCHING\s+DISPATCHED\s+COMPLETED\s+FAILED\s+\}/);
  assert.match(schema, /model GrantReportExportRequest \{/);
  assert.match(schema, /idempotencyKey\s+String\s+@unique @db\.Char\(64\)/);
  assert.match(schema, /requestedBy\s+User\s+@relation\("GrantReportExportRequestRequestedBy"[^\n]+onDelete: Restrict/);
  assert.match(schema, /reportVersion\s+GrantReportVersion\s+@relation\(fields: \[grantReportVersionId, grantReportId\], references: \[id, grantReportId\], onDelete: Restrict/);
  assert.match(schema, /artifact\s+GrantReportExportArtifact\?\s+@relation\("GrantReportExportRequestArtifact", fields: \[artifactId, grantReportVersionId, grantReportId, format\], references: \[id, grantReportVersionId, grantReportId, format\], onDelete: Restrict/);
  assert.match(schema, /@@unique\(\[id, grantReportVersionId, grantReportId, format\], map: "GrantReportExportArtifact_ownership_key"\)/);
});

test("the migration enforces concurrency-safe active request uniqueness", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "GrantReportExportRequest_active_version_format_key"[\s\S]+WHERE "status" IN \('QUEUED', 'DISPATCHING', 'DISPATCHED'\);/,
  );
  assert.match(migration, /CREATE UNIQUE INDEX "GrantReportExportRequest_idempotencyKey_key"/);
  assert.match(migration, /CREATE UNIQUE INDEX "GrantReportExportRequest_dispatchToken_key"/);
  assert.match(migration, /CREATE INDEX "GrantReportExportRequest_status_next_dispatch_idx"/);
  assert.match(migration, /CREATE INDEX "GrantReportExportRequest_status_dispatch_lease_idx"/);
});

test("the migration rejects malformed tokens, counters, failure codes, and inconsistent states", () => {
  for (const constraint of [
    "GrantReportExportRequest_dispatch_attempt_check",
    "GrantReportExportRequest_idempotency_key_check",
    "GrantReportExportRequest_dispatch_token_check",
    "GrantReportExportRequest_failure_code_check",
    "GrantReportExportRequest_timestamp_check",
    "GrantReportExportRequest_state_check",
  ]) {
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"`));
  }
  assert.match(migration, /"status" = 'DISPATCHING'[\s\S]+"dispatchAttemptCount" > 0[\s\S]+"dispatchToken" IS NOT NULL[\s\S]+"dispatchLeaseExpiresAt" IS NOT NULL/);
  assert.match(migration, /"status" = 'COMPLETED'[\s\S]+"artifactId" IS NOT NULL[\s\S]+"completedAt" IS NOT NULL[\s\S]+"failedAt" IS NULL/);
  assert.match(migration, /"status" = 'FAILED'[\s\S]+"failedAt" IS NOT NULL[\s\S]+"lastSafeFailureCode" IS NOT NULL/);
});

test("database foreign keys prevent cross-version artifact attachment and destructive cascades", () => {
  assert.match(
    migration,
    /FOREIGN KEY \("grantReportVersionId", "grantReportId"\)[\s\S]+REFERENCES "GrantReportVersion"\("id", "grantReportId"\)[\s\S]+ON DELETE RESTRICT/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("artifactId", "grantReportVersionId", "grantReportId", "format"\)[\s\S]+REFERENCES "GrantReportExportArtifact"\("id", "grantReportVersionId", "grantReportId", "format"\)[\s\S]+ON DELETE RESTRICT/,
  );
  assert.match(migration, /FOREIGN KEY \("requestedByUserId"\) REFERENCES "User"\("id"\)[\s\S]+ON DELETE RESTRICT/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("request ownership, state transitions, and terminal history are immutable", () => {
  assert.match(migration, /CREATE FUNCTION "protect_grant_report_export_request"\(\)/);
  assert.match(
    migration,
    /TG_OP = 'DELETE'[\s\S]+Grant report export request history cannot be deleted/,
  );
  assert.match(migration, /OLD\."status" IN \('COMPLETED', 'FAILED'\)/);
  assert.match(migration, /OLD\."status" = 'QUEUED' AND NEW\."status" = 'DISPATCHING'/);
  assert.match(migration, /OLD\."status" = 'DISPATCHING' AND NEW\."status" IN \('QUEUED', 'DISPATCHED', 'FAILED'\)/);
  assert.match(migration, /OLD\."status" = 'DISPATCHED' AND NEW\."status" IN \('COMPLETED', 'FAILED'\)/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "GrantReportExportRequest"/);
});

test("dispatch attempt counts increment exactly once on claim and remain monotonic everywhere else", () => {
  assert.match(
    migration,
    /OLD\."status" = 'QUEUED' AND NEW\."status" = 'DISPATCHING'[\s\S]+NEW\."dispatchAttemptCount" <> OLD\."dispatchAttemptCount" \+ 1[\s\S]+Dispatch attempt count must increment exactly once when claimed/,
  );
  assert.match(
    migration,
    /ELSIF NEW\."dispatchAttemptCount" <> OLD\."dispatchAttemptCount" THEN[\s\S]+Dispatch attempt count is immutable outside a new claim/,
  );
  assert.match(migration, /OLD\."status" = 'DISPATCHING' AND NEW\."status" IN \('QUEUED', 'DISPATCHED', 'FAILED'\)/);
  assert.match(migration, /OLD\."status" = 'DISPATCHED' AND NEW\."status" IN \('COMPLETED', 'FAILED'\)/);
});

test("an active dispatch heartbeat preserves its claim token while allowing lease updates", () => {
  assert.match(
    migration,
    /OLD\."status" = 'DISPATCHING'[\s\S]+NEW\."status" = 'DISPATCHING'[\s\S]+NEW\."dispatchToken" IS DISTINCT FROM OLD\."dispatchToken"[\s\S]+Active dispatch claim token is immutable/,
  );
  assert.doesNotMatch(
    migration,
    /NEW\."dispatchLeaseExpiresAt" IS DISTINCT FROM OLD\."dispatchLeaseExpiresAt"[\s\S]+RAISE EXCEPTION/,
  );
  assert.match(
    migration,
    /"status" = 'QUEUED'[\s\S]+"dispatchToken" IS NULL[\s\S]+"dispatchLeaseExpiresAt" IS NULL/,
  );
  assert.match(
    migration,
    /"status" = 'DISPATCHED'[\s\S]+"dispatchToken" IS NULL[\s\S]+"dispatchLeaseExpiresAt" IS NULL/,
  );
  assert.match(
    migration,
    /"status" = 'FAILED'[\s\S]+"dispatchToken" IS NULL[\s\S]+"dispatchLeaseExpiresAt" IS NULL/,
  );
});

test("queue publication evidence cannot be rewritten after dispatch", () => {
  assert.match(
    migration,
    /OLD\."status" = 'DISPATCHED'[\s\S]+NEW\."queueMessageId" IS DISTINCT FROM OLD\."queueMessageId"[\s\S]+NEW\."dispatchedAt" IS DISTINCT FROM OLD\."dispatchedAt"[\s\S]+NEW\."dispatchAttemptCount" IS DISTINCT FROM OLD\."dispatchAttemptCount"[\s\S]+Queue publication evidence is immutable/,
  );
  assert.match(migration, /OLD\."status" = 'DISPATCHED' AND NEW\."status" IN \('COMPLETED', 'FAILED'\)/);
});

test("the migration is additive and does not mutate report or export history", () => {
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration, /\bTRUNCATE\b/i);
  assert.doesNotMatch(migration, /\bALTER\s+COLUMN\b/i);
  assert.doesNotMatch(migration, /\bRENAME\s+(TABLE|COLUMN)\b/i);
  assert.doesNotMatch(migration, /\bUPDATE\s+"?(GrantReport|GrantReportVersion|GrantReportExportArtifact|GrantReportExportAttempt)"?\b/i);
});
