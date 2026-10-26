import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertDedicatedIntegrationEnvironment,
  DISPOSABLE_CONTAINER_PURPOSE_LABEL,
  DISPOSABLE_CONTAINER_RUN_LABEL,
  DISPOSABLE_DATABASE_APPROVAL,
  DISPOSABLE_DATABASE_PURPOSE,
  DisposableDatabaseSafetyError,
  createDisposableChildEnvironment,
  createSafeChildEnvironment,
  parseDockerInspection,
  redactSensitiveDiagnostic,
  validateCleanupTarget,
  validateDisposableDatabaseConnections,
  validateDisposableDatabasePlan,
  validateObservedContainer,
  validateObservedDatabase,
  validatePreSentinelDatabaseIdentity,
  verifyLiveDockerAttestation,
  verifyCanonicalOwnedStatePath,
  withSingleConnectionLimit,
  type DisposableDatabaseConnectionPlan,
} from "./database-safety";
import {
  attestPostgresServerMajor,
  assertTrustedDockerExecutableAgreement,
  assertNoLinksRecursively,
  classifyWindowsTaskkillFailure,
  appendBoundedOutput,
  createBoundedOutputCapture,
  GENERAL_COMMAND_OUTPUT_LIMIT_BYTES,
  parseWhoamiUserSidOutput,
  parseArguments,
  parseExactPsqlRow,
  psqlArguments,
  resolveTrustedTaskkillExecutableForPlatform,
  resolveTrustedIcaclsExecutableForPlatform,
  resolveTrustedWhoamiExecutableForPlatform,
  resolveTrustedCliEntrypoint,
  resolveTrustedDockerCliEntrypointForPlatform,
  runCommand,
  renderBoundedOutput,
  sanitizeWindowsTerminationOutput,
  secureWindowsHarnessPath,
  trustedTaskkillExecutableCandidate,
  trustedIcaclsExecutableCandidate,
  trustedWhoamiExecutableCandidate,
  trustedDockerExecutableCandidates,
  validateIsolatedPrismaDirectory,
  validateWindowsSid,
} from "../../../scripts/grant-report-export-db-integration";
import { bounded, createIntegrationClient } from "./integration-test-context";
import * as integrationTestContext from "./integration-test-context";

const runId = "a".repeat(32);
const nonce = "b".repeat(64);
const image = "postgres:18.6-alpine3.23@sha256:dec395d8c09c45609d6deb5c2388a07882d64fa59b1d98c1895792e085f57888";
const databaseName = `ecdlink_export_it_${runId}`;
const temporaryRoot = `C:\\Temp\\ecdlink-export-it-${runId}`;
const password = "local-disposable-password";
const PROCESS_TREE_TEST_NAME = "timed-out child process trees are terminated before returning";

type SyntheticProcessIdentity = { token: string; pid: number; parentPid?: number; descendantPid?: number };

async function readSyntheticProcessIdentity(path: string, expectedToken: string) {
  const identity = JSON.parse(await readFile(path, "utf8")) as SyntheticProcessIdentity;
  assert.equal(identity.token, expectedToken);
  assert.ok(Number.isSafeInteger(identity.pid) && identity.pid > 0);
  return identity;
}

async function waitForSyntheticProcessIdentity(path: string, expectedToken: string, timeoutMilliseconds: number) {
  const deadline = performance.now() + timeoutMilliseconds;
  while (performance.now() < deadline) {
    try {
      return await readSyntheticProcessIdentity(path, expectedToken);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  throw new Error(`Synthetic process readiness was not observed within ${timeoutMilliseconds}ms.`);
}

function syntheticProcessIsAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

async function observeSyntheticProcessesToExit(
  pids: Iterable<number>,
  timeoutMilliseconds: number,
  observation: {
    isAlive?: (pid: number) => boolean;
    now?: () => number;
    wait?: () => Promise<void>;
  } = {},
) {
  const recordedPids = [...new Set(pids)];
  const isAlive = observation.isAlive ?? syntheticProcessIsAlive;
  const now = observation.now ?? Date.now;
  const wait = observation.wait ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 25)));
  const deadline = now() + timeoutMilliseconds;
  while (recordedPids.some(isAlive)) {
    if (now() >= deadline) {
      throw new Error(
        "The synthetic process tree did not exit within its bounded cleanup window; no PID-based termination was attempted.",
      );
    }
    await wait();
  }
}

function url(name = databaseName, host = "127.0.0.1", port = 55432) {
  return `postgresql://ecdlink_it:${password}@${host}:${port}/${name}`;
}

function plan(overrides: Partial<DisposableDatabaseConnectionPlan> = {}): DisposableDatabaseConnectionPlan {
  return {
    approval: DISPOSABLE_DATABASE_APPROVAL,
    runId,
    nonce,
    databaseName,
    fullHistoryDatabaseName: `ecdlink_export_full_it_${runId}`,
    containerName: `ecdlink-export-it-${runId}`,
    postgresImage: image,
    confirmedProductionPostgresMajor: 18,
    temporaryRoot,
    operatingSystemTemporaryRoot: "C:\\Temp",
    integrationDatabaseUrl: url(),
    integrationDirectUrl: url(),
    expectedHost: "127.0.0.1",
    expectedPort: 55432,
    ...overrides,
  };
}

function container(overrides: Record<string, unknown> = {}) {
  return {
    id: "d".repeat(64),
    name: `ecdlink-export-it-${runId}`,
    image,
    running: true,
    labels: {
      [DISPOSABLE_CONTAINER_PURPOSE_LABEL]: DISPOSABLE_DATABASE_PURPOSE,
      [DISPOSABLE_CONTAINER_RUN_LABEL]: runId,
    },
    hostIp: "127.0.0.1",
    hostPort: 55432,
    postgresDatabase: databaseName,
    postgresUser: "ecdlink_it",
    ...overrides,
  };
}

function rejectsCode(operation: () => unknown, code: string) {
  assert.throws(operation, (error: unknown) => error instanceof DisposableDatabaseSafetyError && error.code === code);
}

test("missing or incorrect approval fails closed", () => {
  rejectsCode(() => validateDisposableDatabasePlan({ ...plan(), approval: "" }), "APPROVAL_REQUIRED");
  rejectsCode(() => validateDisposableDatabasePlan({ ...plan(), approval: "yes" }), "APPROVAL_REQUIRED");
});

test("external, Neon, production, and staging database hosts are rejected", () => {
  for (const host of ["example.com", "pooler.neon.tech", "production.internal", "staging.internal"]) {
    rejectsCode(() => validateDisposableDatabaseConnections({ ...plan(), integrationDatabaseUrl: url(databaseName, host), integrationDirectUrl: url(databaseName, host) }), "EXTERNAL_DATABASE_REJECTED");
  }
});

test("dedicated integration URLs are mandatory and may not fall back to application URLs", () => {
  rejectsCode(() => assertDedicatedIntegrationEnvironment({ ECDLINK_ALLOW_DISPOSABLE_DB_TESTS: DISPOSABLE_DATABASE_APPROVAL }), "MISSING_DATABASE_URL");
  const shared = url();
  rejectsCode(() => assertDedicatedIntegrationEnvironment({
    ECDLINK_ALLOW_DISPOSABLE_DB_TESTS: DISPOSABLE_DATABASE_APPROVAL,
    INTEGRATION_DATABASE_URL: shared,
    INTEGRATION_DIRECT_URL: shared,
    DATABASE_URL: shared,
    DIRECT_URL: shared,
  }), "CONNECTION_FALLBACK_REJECTED");
});

test("runtime and migration targets must match the exact generated database", () => {
  rejectsCode(() => validateDisposableDatabaseConnections({ ...plan(), integrationDirectUrl: url("other") }), "DATABASE_TARGET_MISMATCH");
  rejectsCode(() => validateDisposableDatabaseConnections({ ...plan(), databaseName: "wrong" }), "INVALID_DATABASE_NAME");
});

test("PostgreSQL 18 is the exact supported major and all other or missing majors fail closed", () => {
  assert.equal(validateDisposableDatabasePlan(plan()).confirmedProductionPostgresMajor, 18);
  for (const confirmedProductionPostgresMajor of [16, 17, 19, Number.NaN]) {
    rejectsCode(() => validateDisposableDatabasePlan({ ...plan(), confirmedProductionPostgresMajor }), "POSTGRES_MAJOR_UNCONFIRMED");
  }
  rejectsCode(
    () => validateDisposableDatabasePlan({ ...plan(), confirmedProductionPostgresMajor: undefined as never }),
    "POSTGRES_MAJOR_UNCONFIRMED",
  );
});

test("server-reported PostgreSQL 18 version numbers are parsed numerically and attested", () => {
  assert.deepEqual(attestPostgresServerMajor("180000", 18), { serverVersionNum: 180000, major: 18 });
  assert.deepEqual(attestPostgresServerMajor("180123", 18), { serverVersionNum: 180123, major: 18 });
});

test("server-reported PostgreSQL 17, 16, and other majors fail closed", () => {
  for (const serverVersionNum of ["170000", "160000", "150999", "190000"]) {
    assert.throws(
      () => attestPostgresServerMajor(serverVersionNum, 18),
      /does not match the approved disposable database major/i,
    );
  }
});

test("missing, empty, non-numeric, malformed, ambiguous, and prefix-like versions are rejected", () => {
  for (const serverVersionNum of [
    undefined,
    null,
    "",
    " ",
    "eighteen",
    "18000",
    "0180000",
    "+180000",
    "-180000",
    "180000.1",
    "18e4",
    "180000 ",
    "180000\n170000",
    "180000|unexpected",
    "18-malformed",
  ]) {
    assert.throws(() => attestPostgresServerMajor(serverVersionNum, 18), /missing or malformed/i);
  }
});

test("identity query output must contain exactly one row and the expected number of fields", () => {
  assert.deepEqual(parseExactPsqlRow("database|user|127.0.0.1|5432|180000\n", 5), [
    "database", "user", "127.0.0.1", "5432", "180000",
  ]);
  for (const output of [
    undefined,
    "",
    "\n",
    "database|user|127.0.0.1|5432",
    "database|user|127.0.0.1|5432|180000|unexpected",
    "database|user|127.0.0.1|5432|180000\nother|user|127.0.0.1|5432|180000\n",
    "database|user|127.0.0.1|5432|180000\n\n",
  ]) {
    assert.throws(() => parseExactPsqlRow(output, 5), /missing, malformed, or ambiguous/i);
  }
});

test("approved image major, confirmed major, and running server major must independently agree", () => {
  assert.equal(validateDisposableDatabasePlan(plan()).confirmedProductionPostgresMajor, 18);
  assert.equal(attestPostgresServerMajor("180006", plan().confirmedProductionPostgresMajor).major, 18);
  assert.throws(
    () => attestPostgresServerMajor("170006", plan().confirmedProductionPostgresMajor),
    /does not match the approved disposable database major/i,
  );
});

test("runtime major attestation augments rather than replaces database identity checks", async () => {
  const source = await readFile(join(process.cwd(), "scripts", "grant-report-export-db-integration.ts"), "utf8");
  assert.equal(source.match(/current_setting\('server_version_num'\)/g)?.length, 2);
  assert.match(source, /validatePreSentinelDatabaseIdentity\(state,/);
  assert.match(source, /validateObservedDatabase\(/);
  assert.match(source, /await verifyState\(state, dockerExecutable\);/);
  assert.match(source, /await verifyState\(state, dockerExecutable, false\);/);
  assert.ok(
    source.indexOf("attestPostgresServerMajor(serverVersionNum, expectedPostgresMajor)")
      < source.indexOf("return { databaseName: observedDatabaseName, databaseUser, serverAddress"),
  );
});

test("PostgreSQL images require the exact major, official repository shape, immutable digest, and matching tag", () => {
  for (const postgresImage of [
    "postgres:18-alpine",
    "postgres:18.6-alpine3.23",
    `postgres:18.6-alpine3.23@sha256:${"z".repeat(64)}`,
    `example/postgres:18.6-alpine3.23@sha256:${"c".repeat(64)}`,
    `postgres:17.6-alpine3.23@sha256:${"c".repeat(64)}`,
    `postgres:19.1-alpine3.23@sha256:${"c".repeat(64)}`,
  ]) {
    rejectsCode(() => validateDisposableDatabasePlan({ ...plan(), postgresImage }), "UNPINNED_POSTGRES_IMAGE");
  }
});

test("container identity, labels, and loopback binding are exact", () => {
  assert.equal(validateObservedContainer(plan(), container()).id, "d".repeat(64));
  rejectsCode(() => validateObservedContainer(plan(), container({ labels: {} })), "CONTAINER_LABEL_MISMATCH");
  rejectsCode(() => validateObservedContainer(plan(), container({ hostIp: "0.0.0.0" })), "CONTAINER_BINDING_MISMATCH");
  rejectsCode(() => validateObservedContainer(plan(), container({ name: "other" })), "CONTAINER_IDENTITY_MISMATCH");
  rejectsCode(() => validateObservedContainer(plan(), container({ postgresDatabase: "other" })), "CONTAINER_IDENTITY_MISMATCH");
});

test("sentinel purpose, run ID, nonce, user, and database identity must all match", () => {
  const observed = { databaseName, databaseUser: "ecdlink_it", serverAddress: "127.0.0.1", serverPort: 5432, purpose: DISPOSABLE_DATABASE_PURPOSE, runId, nonce };
  assert.equal(validateObservedDatabase(plan(), observed).runId, runId);
  rejectsCode(() => validateObservedDatabase(plan(), { ...observed, purpose: "TEST" }), "SENTINEL_MISMATCH");
  rejectsCode(() => validateObservedDatabase(plan(), { ...observed, runId: "e".repeat(32) }), "SENTINEL_MISMATCH");
  rejectsCode(() => validateObservedDatabase(plan(), { ...observed, nonce: "f".repeat(64) }), "SENTINEL_MISMATCH");
  rejectsCode(() => validateObservedDatabase(plan(), { ...observed, databaseName: "other" }), "DATABASE_IDENTITY_MISMATCH");
  rejectsCode(() => validateObservedDatabase(plan(), { ...observed, databaseUser: "other" }), "DATABASE_IDENTITY_MISMATCH");
});

test("live Docker attestation rejects forged state and substituted containers", async () => {
  const approved = { ...plan(), containerId: "d".repeat(64) };
  assert.equal((await verifyLiveDockerAttestation(approved, async () => container())).id, approved.containerId);
  await assert.rejects(() => verifyLiveDockerAttestation(approved, async () => container({ id: "e".repeat(64) })), /container ID/i);
  await assert.rejects(() => verifyLiveDockerAttestation(approved, async () => container({ labels: {} })), /labelled/i);
  await assert.rejects(() => verifyLiveDockerAttestation(approved, async () => container({ image: image.replace("18.6", "18.7") })), /pinned image/i);
  await assert.rejects(() => verifyLiveDockerAttestation(approved, async () => container({ hostPort: 55433 })), /loopback endpoint/i);
  await assert.rejects(() => verifyLiveDockerAttestation(approved, async () => container({ running: false })), /not running/i);
  const alternate = { ...approved, expectedPort: 55433, integrationDatabaseUrl: url(databaseName, "127.0.0.1", 55433), integrationDirectUrl: url(databaseName, "127.0.0.1", 55433) };
  await assert.rejects(() => verifyLiveDockerAttestation(alternate, async () => container()), /loopback endpoint/i);
});

test("Docker attestation fails closed for missing CLI, inspection failure, and timeout", async () => {
  await assert.rejects(() => resolveTrustedDockerCliEntrypointForPlatform("win32", async () => null), /could not be resolved/i);
  const approved = { ...plan(), containerId: "d".repeat(64) };
  await assert.rejects(() => verifyLiveDockerAttestation(approved, async () => { throw new Error("provider detail"); }), /could not be independently verified/i);
  await assert.rejects(() => verifyLiveDockerAttestation(approved, () => new Promise(() => undefined), 5), /bounded execution time/i);
});

test("Docker inspection parsing requires one running container and one exact PostgreSQL binding", () => {
  const inspection = JSON.stringify([{
    Id: "d".repeat(64), Name: `/ecdlink-export-it-${runId}`, State: { Running: true },
    Config: { Image: image, Labels: container().labels, Env: [`POSTGRES_DB=${databaseName}`, "POSTGRES_USER=ecdlink_it"] },
    NetworkSettings: { Ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55432" }] } },
  }]);
  assert.deepEqual(parseDockerInspection(inspection), container());
  assert.throws(() => parseDockerInspection("not-json"), /invalid container inspection/i);
});

test("the supported integration context exposes no raw URL-bearing environment helper", () => {
  assert.equal("requireIntegrationEnvironment" in integrationTestContext, false);
  assert.equal(typeof integrationTestContext.createIntegrationClient, "function");
});

test("live Docker attestation precedes Prisma construction in the verified client factory", async () => {
  const source = await readFile(join(process.cwd(), "lib", "grant-report-export", "integration", "integration-test-context.ts"), "utf8");
  const attestation = source.indexOf("await verifyLiveDockerAttestation(state,");
  const construction = source.indexOf("new PrismaClient(");
  assert.ok(attestation >= 0, "The verified client factory must perform live Docker attestation.");
  assert.ok(construction > attestation, "Prisma must not be constructed before live Docker attestation succeeds.");
});

test("bounded teardown reports a stalled disconnect instead of hanging indefinitely", async () => {
  await assert.rejects(() => bounded(new Promise<void>(() => undefined), 5), /exceeded 5ms/i);
});

test("cleanup refuses unverified containers and paths outside the operating-system temporary root", () => {
  assert.equal(validateCleanupTarget(plan(), container()).containerId, "d".repeat(64));
  rejectsCode(() => validateCleanupTarget({ ...plan(), temporaryRoot: "C:\\workspace" }, container()), "UNSAFE_TEMPORARY_ROOT");
  rejectsCode(() => validateCleanupTarget(plan(), container({ id: "short" })), "INVALID_CONTAINER_ID");
});

test("diagnostics redact URLs and credential-like values", () => {
  const diagnostic = redactSensitiveDiagnostic(`connect ${url()} password=hunter2 token=abc secret=value authorization=Bearer`);
  assert.doesNotMatch(diagnostic, /hunter2|local-disposable-password|token=abc|secret=value|authorization=Bearer/);
  assert.match(diagnostic, /REDACTED/);
});

test("each integration Prisma client is constrained to one connection", () => {
  const constrained = new URL(withSingleConnectionLimit(`${url()}?connection_limit=6&pool_timeout=10`));
  assert.equal(constrained.searchParams.get("connection_limit"), "1");
  assert.equal(constrained.searchParams.get("pool_timeout"), "10");
});

test("pre-sentinel identity requires the generated database, user, and local server", () => {
  const observed = { databaseName, databaseUser: "ecdlink_it", serverAddress: "127.0.0.1", serverPort: 5432 };
  assert.equal(validatePreSentinelDatabaseIdentity(plan(), observed).databaseName, databaseName);
  rejectsCode(() => validatePreSentinelDatabaseIdentity(plan(), { ...observed, databaseName: "forged" }), "DATABASE_IDENTITY_MISMATCH");
  rejectsCode(() => validatePreSentinelDatabaseIdentity(plan(), { ...observed, databaseUser: "postgres" }), "DATABASE_IDENTITY_MISMATCH");
});

test("child environments exclude inherited credentials and dangerous runtime overrides", () => {
  const source = {
    PATH: "C:\\attacker-controlled-bin",
    ProgramFiles: "C:\\attacker-controlled-program-files",
    PROGRAMFILES: "C:\\Program Files",
    DATABASE_URL: "production",
    DIRECT_URL: "production-direct",
    NODE_OPTIONS: "--require malicious.js",
    PRISMA_QUERY_ENGINE_BINARY: "malicious.exe",
    AWS_SECRET_ACCESS_KEY: "secret",
  };
  const safe = createSafeChildEnvironment(source);
  assert.equal(safe.PATH, "C:\\attacker-controlled-bin");
  assert.equal(safe.ProgramFiles, undefined);
  assert.equal(safe.PROGRAMFILES, undefined);
  for (const key of ["DATABASE_URL", "DIRECT_URL", "NODE_OPTIONS", "PRISMA_QUERY_ENGINE_BINARY", "AWS_SECRET_ACCESS_KEY"]) assert.equal(safe[key], undefined);

  const validated = createDisposableChildEnvironment(source, { DATABASE_URL: url(), DIRECT_URL: url() });
  assert.equal(validated.DATABASE_URL, url());
  assert.throws(() => createDisposableChildEnvironment(source, { DATABASE_URL: url() }, { DATABASE_URL: "forged" }), /cannot override/i);
  assert.throws(() => createDisposableChildEnvironment(source, { DATABASE_URL: url() }, { NODE_OPTIONS: "--inspect" }), /cannot override/i);
  assert.throws(() => createDisposableChildEnvironment(source, { DATABASE_URL: url() }, { PRISMA_SCHEMA_ENGINE_BINARY: "other" }), /cannot override/i);
});

test("trusted Docker resolution ignores forged environment paths and accepts only fixed OS locations", async () => {
  const approved = trustedDockerExecutableCandidates("win32");
  assert.deepEqual(approved, [
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    "C:\\ProgramData\\DockerDesktop\\version-bin\\docker.exe",
  ]);
  assert.equal(approved.some((candidate) => candidate.includes("attacker-controlled")), false);
  const selected = await resolveTrustedDockerCliEntrypointForPlatform("win32", async (candidate) => ({
    isFile: true,
    isSymbolicLink: false,
    canonicalPath: candidate,
  }));
  assert.equal(selected, approved[0]);
});

test("trusted Docker resolution rejects symlinks and unexpected executable substitution", async () => {
  await assert.rejects(() => resolveTrustedDockerCliEntrypointForPlatform("win32", async (candidate) => ({
    isFile: true,
    isSymbolicLink: true,
    canonicalPath: candidate,
  })), /could not be resolved/i);
  await assert.rejects(() => resolveTrustedDockerCliEntrypointForPlatform("win32", async () => ({
    isFile: true,
    isSymbolicLink: false,
    canonicalPath: "C:\\attacker-controlled-bin\\docker.exe",
  })), /could not be resolved/i);
});

test("orchestrator and child Docker identity disagreement or state override fails closed", () => {
  const [primary, alternate] = trustedDockerExecutableCandidates("win32");
  assert.equal(assertTrustedDockerExecutableAgreement(primary, primary, "win32"), primary);
  assert.throws(() => assertTrustedDockerExecutableAgreement(primary, alternate, "win32"), /do not match/i);
  assert.throws(() => assertTrustedDockerExecutableAgreement("C:\\forged\\docker.exe", primary, "win32"), /do not match/i);
});

test("all orchestrator Docker operations use the resolved absolute executable", async () => {
  const source = await readFile(join(process.cwd(), "scripts", "grant-report-export-db-integration.ts"), "utf8");
  assert.doesNotMatch(source, /commandName\(["']docker["']\)/);
  assert.doesNotMatch(source, /runCommand\(["']docker(?:\.exe)?["']/);
  assert.match(source, /runCommand\(dockerExecutable,/);
});

test("Windows taskkill resolution uses only fixed canonical system paths", async () => {
  assert.equal(trustedTaskkillExecutableCandidate("win32", "x64"), "C:\\Windows\\System32\\taskkill.exe");
  assert.equal(trustedTaskkillExecutableCandidate("win32", "ia32"), "C:\\Windows\\Sysnative\\taskkill.exe");
  assert.throws(() => trustedTaskkillExecutableCandidate("linux", "x64"), /only available on Windows/i);
  assert.throws(() => trustedTaskkillExecutableCandidate("win32", "unsupported"), /no approved taskkill/i);
  const trusted = await resolveTrustedTaskkillExecutableForPlatform("win32", "x64", async (path) => ({
    isFile: true,
    isSymbolicLink: false,
    canonicalPath: path,
  }));
  assert.equal(trusted, "C:\\Windows\\System32\\taskkill.exe");
  await assert.rejects(
    () => resolveTrustedTaskkillExecutableForPlatform("win32", "x64", async () => null),
    /unavailable or unsafe/i,
  );
  await assert.rejects(
    () => resolveTrustedTaskkillExecutableForPlatform("win32", "x64", async () => ({
      isFile: true,
      isSymbolicLink: true,
      canonicalPath: "C:\\Windows\\System32\\taskkill.exe",
    })),
    /unavailable or unsafe/i,
  );
  await assert.rejects(
    () => resolveTrustedTaskkillExecutableForPlatform("win32", "x64", async () => ({
      isFile: true,
      isSymbolicLink: false,
      canonicalPath: "C:\\Temp\\taskkill.exe",
    })),
    /canonical-path verification/i,
  );
});

test("Windows icacls resolution uses only fixed canonical system paths", async () => {
  assert.equal(trustedIcaclsExecutableCandidate("win32", "x64"), "C:\\Windows\\System32\\icacls.exe");
  assert.equal(trustedIcaclsExecutableCandidate("win32", "ia32"), "C:\\Windows\\Sysnative\\icacls.exe");
  assert.throws(() => trustedIcaclsExecutableCandidate("linux", "x64"), /only available on Windows/i);
  assert.throws(() => trustedIcaclsExecutableCandidate("win32", "unsupported"), /no approved icacls/i);
  const trusted = await resolveTrustedIcaclsExecutableForPlatform("win32", "x64", async (path) => ({
    isFile: true,
    isSymbolicLink: false,
    canonicalPath: path,
  }));
  assert.equal(trusted, "C:\\Windows\\System32\\icacls.exe");
  await assert.rejects(
    () => resolveTrustedIcaclsExecutableForPlatform("win32", "x64", async () => null),
    /unavailable or unsafe/i,
  );
  await assert.rejects(
    () => resolveTrustedIcaclsExecutableForPlatform("win32", "x64", async (path) => ({
      isFile: true,
      isSymbolicLink: true,
      canonicalPath: path,
    })),
    /unavailable or unsafe/i,
  );
  await assert.rejects(
    () => resolveTrustedIcaclsExecutableForPlatform("win32", "x64", async () => ({
      isFile: true,
      isSymbolicLink: false,
      canonicalPath: "C:\\attacker-controlled-bin\\icacls.exe",
    })),
    /canonical-path verification/i,
  );
});

test("Windows ACL hardening ignores PATH and invokes only the trusted executable", async () => {
  const invocations: Array<{ command: string; args: string[] }> = [];
  await secureWindowsHarnessPath("C:\\Temp\\owned", "directory", {
    platform: "win32",
    architecture: "x64",
    sid: "S-1-5-21-100-200-300-400",
    probe: async (path) => ({ isFile: true, isSymbolicLink: false, canonicalPath: path }),
    execute: async (command, args) => {
      invocations.push({ command, args });
      return { stdout: "", stderr: "" };
    },
  });
  assert.deepEqual(invocations, [{
    command: "C:\\Windows\\System32\\icacls.exe",
    args: ["C:\\Temp\\owned", "/inheritance:r", "/grant:r", "*S-1-5-21-100-200-300-400:(OI)(CI)(F)"],
  }]);
  const source = await readFile(join(process.cwd(), "scripts", "grant-report-export-db-integration.ts"), "utf8");
  assert.doesNotMatch(source, /runCommand\(["']icacls\.exe["']/);
  await assert.rejects(
    () => secureWindowsHarnessPath("C:\\Temp\\owned", "directory", {
      platform: "win32",
      architecture: "x64",
      sid: "S-1-5-21-100-200-300-400",
      probe: async (path) => ({ isFile: true, isSymbolicLink: false, canonicalPath: path }),
      execute: async () => { throw new Error("ACL operation failed"); },
    }),
    /ACL operation failed/i,
  );
});

test("Windows ACL identity is resolved from trusted whoami SID output without username fallback", async () => {
  assert.equal(trustedWhoamiExecutableCandidate("win32", "x64"), "C:\\Windows\\System32\\whoami.exe");
  assert.equal(trustedWhoamiExecutableCandidate("win32", "ia32"), "C:\\Windows\\Sysnative\\whoami.exe");
  assert.throws(() => trustedWhoamiExecutableCandidate("linux", "x64"), /only available on Windows/i);
  assert.throws(() => trustedWhoamiExecutableCandidate("win32", "unsupported"), /no approved whoami/i);
  assert.equal(validateWindowsSid("S-1-5-21-100-200-300-400"), "S-1-5-21-100-200-300-400");
  assert.throws(() => validateWindowsSid(""), /missing or invalid/i);
  assert.throws(() => validateWindowsSid("DOMAIN\\ECDLinkTester"), /missing or invalid/i);
  assert.throws(() => validateWindowsSid("S-1-5-21-100/../../Administrators"), /missing or invalid/i);
  assert.throws(() => validateWindowsSid("S-1-281474976710656-1"), /missing or invalid/i);
  assert.throws(() => validateWindowsSid("S-1-5-4294967296"), /missing or invalid/i);
  assert.equal(
    parseWhoamiUserSidOutput('"LOCAL\\same-name","S-1-5-21-100-200-300-400"'),
    "S-1-5-21-100-200-300-400",
  );
  assert.equal(
    parseWhoamiUserSidOutput('"DOMAIN\\same-name","S-1-5-21-900-800-700-600"'),
    "S-1-5-21-900-800-700-600",
  );
  assert.throws(() => parseWhoamiUserSidOutput('"DOMAIN\\user",""'), /missing or malformed/i);
  assert.throws(() => parseWhoamiUserSidOutput("S-1-5-21-100"), /missing or malformed/i);
  assert.throws(
    () => parseWhoamiUserSidOutput('"DOMAIN\\user","S-1-5-21-100"\n"DOMAIN\\other","S-1-5-21-200"'),
    /missing or malformed/i,
  );
  const resolved = await resolveTrustedWhoamiExecutableForPlatform("win32", "x64", async (path) => ({
    isFile: true,
    isSymbolicLink: false,
    canonicalPath: path,
  }));
  assert.equal(resolved, "C:\\Windows\\System32\\whoami.exe");
  const previousUsername = process.env.USERNAME;
  const previousDomain = process.env.USERDOMAIN;
  process.env.USERNAME = "attacker-controlled";
  process.env.USERDOMAIN = "attacker-controlled";
  const invocations: Array<{ command: string; args: string[] }> = [];
  try {
    await secureWindowsHarnessPath("C:\\Temp\\owned-file", "file", {
      platform: "win32",
      architecture: "x64",
      probe: async (path) => ({ isFile: true, isSymbolicLink: false, canonicalPath: path }),
      execute: async (command, args) => {
        invocations.push({ command, args });
        if (command.endsWith("whoami.exe")) {
          return { stdout: '"TRUSTED\\process-user","S-1-5-21-111-222-333-444"\r\n', stderr: "" };
        }
        return { stdout: "", stderr: "" };
      },
    });
  } finally {
    if (previousUsername === undefined) delete process.env.USERNAME;
    else process.env.USERNAME = previousUsername;
    if (previousDomain === undefined) delete process.env.USERDOMAIN;
    else process.env.USERDOMAIN = previousDomain;
  }
  assert.deepEqual(invocations, [
    {
      command: "C:\\Windows\\System32\\whoami.exe",
      args: ["/user", "/fo", "csv", "/nh"],
    },
    {
      command: "C:\\Windows\\System32\\icacls.exe",
      args: ["C:\\Temp\\owned-file", "/inheritance:r", "/grant:r", "*S-1-5-21-111-222-333-444:(R,W)"],
    },
  ]);
  const source = await readFile(join(process.cwd(), "scripts", "grant-report-export-db-integration.ts"), "utf8");
  assert.doesNotMatch(source, /userInfo\(\)|process\.env\.(?:USER|USERNAME|USERDOMAIN)/);
});

test("credential-bearing files are written only after the harness directory ACL succeeds", async () => {
  const source = await readFile(join(process.cwd(), "scripts", "grant-report-export-db-integration.ts"), "utf8");
  const directoryCreation = source.indexOf("await mkdir(temporaryRoot");
  const directoryAcl = source.indexOf("await secureHarnessDirectory(temporaryRoot)");
  const credentialWrite = source.indexOf("await writeFile(envPath");
  const credentialAcl = source.indexOf("await restrictStateFile(envPath)");
  const stateWrite = source.indexOf("await writeState(state)");
  const preparationStart = source.indexOf("async function prepare()");
  const guardedPreparation = source.indexOf("  try {", preparationStart);
  const failedPreparationCleanup = source.indexOf("await assertNoLinksRecursively(temporaryRoot)", credentialWrite);
  assert.ok(directoryCreation >= 0 && directoryAcl > directoryCreation);
  assert.ok(guardedPreparation > preparationStart && guardedPreparation < directoryCreation);
  assert.ok(credentialWrite > directoryAcl);
  assert.ok(credentialAcl > credentialWrite);
  assert.ok(stateWrite > credentialAcl);
  assert.ok(failedPreparationCleanup > stateWrite);
});

test("general command output is bounded and truncation fails closed", async () => {
  const large = GENERAL_COMMAND_OUTPUT_LIMIT_BYTES + 16_384;
  await assert.rejects(
    () => runCommand(process.execPath, ["-e", `process.stdout.write("x".repeat(${large}))`]),
    /exited with code 0.*output exceeded the bounded capture limit.*stdout=/i,
  );
  await assert.rejects(
    () => runCommand(process.execPath, ["-e", `process.stderr.write("y".repeat(${large}))`]),
    /output exceeded the bounded capture limit.*stderr=/i,
  );
  await assert.rejects(
    () => runCommand(process.execPath, ["-e", `process.stdout.write("x".repeat(${large})); process.stderr.write("y".repeat(${large}))`]),
    /output exceeded the bounded capture limit/i,
  );
});

test("bounded output capture evicts chunks without repeated full-tail concatenation", () => {
  const exact = createBoundedOutputCapture();
  for (let index = 0; index < 1_024; index += 1) {
    appendBoundedOutput(exact, Buffer.alloc(1_024, index % 251));
  }
  assert.equal(exact.retainedBytes, GENERAL_COMMAND_OUTPUT_LIMIT_BYTES);
  assert.equal(exact.truncated, false);
  assert.equal(renderBoundedOutput(exact).length, GENERAL_COMMAND_OUTPUT_LIMIT_BYTES);

  appendBoundedOutput(exact, Buffer.from("Z"));
  assert.equal(exact.retainedBytes, GENERAL_COMMAND_OUTPUT_LIMIT_BYTES);
  assert.equal(exact.truncated, true);
  const retainedTail = renderBoundedOutput(exact);
  assert.equal(retainedTail.endsWith("Z"), true);
  assert.match(retainedTail, /output truncated/);

  const large = createBoundedOutputCapture();
  appendBoundedOutput(large, Buffer.concat([
    Buffer.from("discarded"),
    Buffer.alloc(GENERAL_COMMAND_OUTPUT_LIMIT_BYTES - 4, "x"),
    Buffer.from("TAIL"),
  ]));
  assert.equal(large.retainedBytes, GENERAL_COMMAND_OUTPUT_LIMIT_BYTES);
  assert.equal(renderBoundedOutput(large).endsWith("TAIL"), true);

  const source = appendBoundedOutput.toString();
  assert.doesNotMatch(source, /Buffer\.concat/);
});

test("general command failures preserve exit semantics and sanitize bounded diagnostics", async () => {
  await assert.rejects(
    () => runCommand(process.execPath, ["-e", 'process.stderr.write("password=hunter2 postgresql://user:pass@127.0.0.1:5432/db"); process.exit(7)']),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /exited with code 7/i);
      assert.doesNotMatch(message, /hunter2|user:pass/);
      assert.match(message, /REDACTED/);
      return true;
    },
  );
});

test("Windows taskkill failures remain classified, bounded, and sanitized", () => {
  const base = {
    executable: "trusted_system32" as const,
    arguments: ["/PID", "[OWNED_CHILD_PID]", "/T", "/F"] as const,
    exitCode: 5,
    signal: null,
    timedOut: false,
    elapsedMilliseconds: 12.5,
    stdout: sanitizeWindowsTerminationOutput(Buffer.from(`token=secret ${"x".repeat(8_192)}`)),
    stderr: "Access is denied.",
  };
  const nonzero = classifyWindowsTaskkillFailure(base);
  assert.equal(nonzero.diagnostic.classification, "nonzero_exit");
  assert.equal(nonzero.diagnostic.exitCode, 5);
  assert.doesNotMatch(nonzero.message, /token=secret/);
  assert.ok(nonzero.diagnostic.stdout.length <= 4_096);
  const timeout = classifyWindowsTaskkillFailure({ ...base, exitCode: null, timedOut: true });
  assert.equal(timeout.diagnostic.classification, "timeout");
  const signal = classifyWindowsTaskkillFailure({ ...base, exitCode: null, signal: "SIGTERM" });
  assert.equal(signal.diagnostic.classification, "signal");
  const spawnError = classifyWindowsTaskkillFailure({
    ...base,
    exitCode: null,
    spawnError: new Error("authorization=Bearer-secret"),
  });
  assert.equal(spawnError.diagnostic.classification, "spawn_error");
  assert.doesNotMatch(spawnError.message, /Bearer-secret/);
});

test("Windows termination source has no bare-name taskkill fallback", async () => {
  const source = await readFile(join(process.cwd(), "scripts", "grant-report-export-db-integration.ts"), "utf8");
  assert.doesNotMatch(source, /spawn\(["']taskkill\.exe["']/);
  assert.match(source, /spawn\(taskkillExecutable,/);
  assert.match(source, /\["\/PID", String\(child\.pid\), "\/T", "\/F"\]/);
});

test("state-consuming commands require one explicit temporary state path", () => {
  assert.equal(parseArguments(["prepare"]).mode, "prepare");
  assert.throws(() => parseArguments(["test"]), /explicit --state/i);
  assert.throws(() => parseArguments(["cleanup", "--state", join(tmpdir(), "a"), "--state", join(tmpdir(), "b")]), /exactly one/i);
  assert.equal(parseArguments(["test", "--state", join(tmpdir(), "owned", "integration-state.json")]).mode, "test");
});

test("direct Prisma client access fails before connection when orchestrator state is absent", async () => {
  const keys = [
    "ECDLINK_ALLOW_DISPOSABLE_DB_TESTS", "INTEGRATION_DATABASE_URL", "INTEGRATION_DIRECT_URL",
    "ECDLINK_INTEGRATION_RUN_ID", "ECDLINK_INTEGRATION_NONCE", "ECDLINK_INTEGRATION_DATABASE_NAME",
    "ECDLINK_INTEGRATION_CONTAINER_ID", "ECDLINK_INTEGRATION_STATE_PATH", "ECDLINK_INTEGRATION_STATE_PROOF",
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    ECDLINK_ALLOW_DISPOSABLE_DB_TESTS: DISPOSABLE_DATABASE_APPROVAL,
    INTEGRATION_DATABASE_URL: url(),
    INTEGRATION_DIRECT_URL: url(),
    ECDLINK_INTEGRATION_RUN_ID: runId,
    ECDLINK_INTEGRATION_NONCE: nonce,
    ECDLINK_INTEGRATION_DATABASE_NAME: databaseName,
    ECDLINK_INTEGRATION_CONTAINER_ID: "d".repeat(64),
    ECDLINK_INTEGRATION_STATE_PROOF: "e".repeat(64),
  });
  delete process.env.ECDLINK_INTEGRATION_STATE_PATH;
  try {
    await assert.rejects(() => createIntegrationClient(), /state path is required/i);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("sentinel SQL and nonce are supplied through stdin rather than process arguments", () => {
  const args = psqlArguments("d".repeat(64), databaseName, true);
  assert.equal(args.includes("--command"), false);
  assert.equal(args.includes("--file=-"), true);
  assert.equal(args.some((value) => value.includes(nonce)), false);
});

test("trusted CLI entrypoints are regular project dependency files and Prisma runs outside the repository", async () => {
  assert.match(await resolveTrustedCliEntrypoint(join("prisma", "build", "index.js")), /node_modules[\\/]prisma[\\/]build[\\/]index\.js$/);
  assert.match(await resolveTrustedCliEntrypoint(join("tsx", "dist", "cli.mjs")), /node_modules[\\/]tsx[\\/]dist[\\/]cli\.mjs$/);
  await assert.rejects(() => resolveTrustedCliEntrypoint(join("..", "package.json")), /outside/i);
  const root = await mkdtemp(join(tmpdir(), "ecdlink-prisma-isolation-"));
  try {
    const prismaRoot = join(root, "prisma");
    await mkdir(prismaRoot);
    const schema = join(prismaRoot, "schema.prisma");
    await writeFile(schema, "generator client { provider = \"prisma-client-js\" }\n");
    assert.equal(await validateIsolatedPrismaDirectory(schema), prismaRoot);
    await writeFile(join(prismaRoot, ".env"), "DATABASE_URL=forbidden\n");
    await assert.rejects(() => validateIsolatedPrismaDirectory(schema), /prohibited environment/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("synthetic cleanup observes self-expiry without terminating recorded PIDs", async () => {
  let probeCount = 0;
  await observeSyntheticProcessesToExit([101, 102], 100, {
    isAlive: () => {
      probeCount += 1;
      return probeCount < 4;
    },
    now: () => 0,
    wait: async () => undefined,
  });
  assert.ok(probeCount >= 4);
});

test("synthetic cleanup fails safely when a stale PID may have been reused", async () => {
  let now = 0;
  await assert.rejects(
    () => observeSyntheticProcessesToExit([4242], 10, {
      isAlive: () => true,
      now: () => now,
      wait: async () => { now += 10; },
    }),
    /no PID-based termination was attempted/i,
  );
});

test("synthetic identity evidence rejects missing and malformed records", async () => {
  const root = await mkdtemp(join(tmpdir(), "ecdlink-process-identity-"));
  const missing = join(root, "missing.json");
  const malformed = join(root, "malformed.json");
  try {
    await assert.rejects(() => readSyntheticProcessIdentity(missing, "expected"), { code: "ENOENT" });
    await writeFile(malformed, "not-json", { flag: "wx" });
    await assert.rejects(() => readSyntheticProcessIdentity(malformed, "expected"), SyntaxError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Grant Reporting script selects the exact process-tree test name", async () => {
  const packageJson = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const script = packageJson.scripts?.["test:grant-reports"] ?? "";
  const exactPattern = `^${PROCESS_TREE_TEST_NAME}$`;
  const isolatedSelection = `--test-name-pattern=\"${exactPattern}\"`;
  const regularExclusion = `--test-skip-pattern=\"${exactPattern}\"`;
  assert.equal(script.split(isolatedSelection).length - 1, 1);
  assert.equal(script.split(regularExclusion).length - 1, 1);
  const matcher = new RegExp(exactPattern);
  assert.match(PROCESS_TREE_TEST_NAME, matcher);
  assert.doesNotMatch(`${PROCESS_TREE_TEST_NAME} similar`, matcher);
  assert.doesNotMatch("timed-out.child.process.trees.are.terminated.before.returning", matcher);
});

test(PROCESS_TREE_TEST_NAME, async () => {
  const root = await mkdtemp(join(tmpdir(), "ecdlink-process-tree-"));
  const syntheticSelfExpiryMilliseconds = 15_000;
  const cleanupObservationMilliseconds = syntheticSelfExpiryMilliseconds + 2_500;
  const startedAt = Date.now();
  const token = `ecdlink-process-tree-${process.pid}-${Date.now()}`;
  const parentScriptPath = join(root, "parent.cjs");
  const descendantScriptPath = join(root, "descendant.cjs");
  const parentIdentityPath = join(root, "parent-identity.json");
  const descendantIdentityPath = join(root, "descendant-identity.json");
  const treeReadyPath = join(root, "tree-ready.json");
  const ownedPids = new Set<number>();
  const descendantScript = [
    'const { writeFileSync } = require("node:fs");',
    'const [identityPath, token] = process.argv.slice(2);',
    'writeFileSync(identityPath, JSON.stringify({ token, pid: process.pid, parentPid: process.ppid }), { flag: "wx" });',
    'setTimeout(() => process.exit(90), 15_000).unref();',
    'setInterval(() => undefined, 1_000);',
  ].join("\n");
  const parentScript = [
    'const { spawn } = require("node:child_process");',
    'const { readFileSync, writeFileSync } = require("node:fs");',
    'const [descendantScriptPath, parentIdentityPath, descendantIdentityPath, treeReadyPath, token] = process.argv.slice(2);',
    'writeFileSync(parentIdentityPath, JSON.stringify({ token, pid: process.pid }), { flag: "wx" });',
    'const descendant = spawn(process.execPath, [descendantScriptPath, descendantIdentityPath, token], { stdio: "ignore", windowsHide: true });',
    'let settled = false;',
    'const fail = () => { if (!settled) process.exit(91); };',
    'descendant.once("error", fail);',
    'descendant.once("exit", fail);',
    'const deadline = Date.now() + 5_000;',
    'const announceReady = () => {',
    '  try {',
    '    const child = JSON.parse(readFileSync(descendantIdentityPath, "utf8"));',
    '    if (child.token !== token || child.parentPid !== process.pid || child.pid !== descendant.pid) process.exit(92);',
    '    writeFileSync(treeReadyPath, JSON.stringify({ token, pid: process.pid, descendantPid: child.pid }), { flag: "wx" });',
    '    settled = true;',
    '  } catch (error) {',
    '    if (error.code !== "ENOENT" || Date.now() >= deadline) process.exit(93);',
    '    setTimeout(announceReady, 10);',
    '  }',
    '};',
    'announceReady();',
    'setTimeout(() => process.exit(94), 15_000).unref();',
    'setInterval(() => undefined, 1_000);',
  ].join("\n");
  try {
    await writeFile(descendantScriptPath, descendantScript, { flag: "wx" });
    await writeFile(parentScriptPath, parentScript, { flag: "wx" });
    const commandStartedAt = performance.now();
    const commandOutcome = bounded(runCommand(process.execPath, [
        parentScriptPath,
        descendantScriptPath,
        parentIdentityPath,
        descendantIdentityPath,
        treeReadyPath,
        token,
      ], { timeoutMilliseconds: 1_000 }), 8_000).then(
      () => ({ error: undefined, finishedAt: performance.now() }),
      (error: unknown) => ({ error, finishedAt: performance.now() }),
    );
    const readinessStartedAt = performance.now();
    const [parent, descendant, ready] = await Promise.all([
      waitForSyntheticProcessIdentity(parentIdentityPath, token, 750),
      waitForSyntheticProcessIdentity(descendantIdentityPath, token, 750),
      waitForSyntheticProcessIdentity(treeReadyPath, token, 750),
    ]);
    const readinessObservedAt = performance.now();
    ownedPids.add(parent.pid);
    ownedPids.add(descendant.pid);
    assert.equal(descendant.parentPid, parent.pid);
    assert.equal(ready.pid, parent.pid);
    assert.equal(ready.descendantPid, descendant.pid);
    const outcome = await commandOutcome;
    const parentAliveWhenReported = syntheticProcessIsAlive(parent.pid);
    const descendantAliveWhenReported = syntheticProcessIsAlive(descendant.pid);
    const commandError = outcome.error instanceof Error ? outcome.error : new Error(String(outcome.error));
    assert.match(commandError.message, /process tree was terminated/i, [
      `runCommand termination diagnostic for ${token}:`,
      `readinessWait=${(readinessObservedAt - readinessStartedAt).toFixed(1)}ms`,
      `totalElapsed=${(outcome.finishedAt - commandStartedAt).toFixed(1)}ms`,
      `parentReady=true descendantReady=true relationshipReady=true`,
      `parentAliveWhenReported=${parentAliveWhenReported}`,
      `descendantAliveWhenReported=${descendantAliveWhenReported}`,
      `reportedError=${commandError.message}`,
      "taskkill diagnostics are included in reportedError when termination fails.",
    ].join(" "));
    await observeSyntheticProcessesToExit(ownedPids, 2_000);
    await access(parentIdentityPath);
    await access(descendantIdentityPath);
    await access(treeReadyPath);
  } finally {
    const cleanupErrors: unknown[] = [];
    let identityEvidenceComplete = true;
    for (const path of [parentIdentityPath, descendantIdentityPath, treeReadyPath]) {
      try {
        const identity = await readSyntheticProcessIdentity(path, token);
        ownedPids.add(identity.pid);
        if (identity.descendantPid) ownedPids.add(identity.descendantPid);
      } catch (error) {
        identityEvidenceComplete = false;
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") cleanupErrors.push(error);
      }
    }
    if (!identityEvidenceComplete) {
      const remainingSelfExpiryWindow = Math.max(0, startedAt + cleanupObservationMilliseconds - Date.now());
      await new Promise((resolve) => setTimeout(resolve, remainingSelfExpiryWindow));
    }
    let processObservationComplete = false;
    try {
      await observeSyntheticProcessesToExit(ownedPids, cleanupObservationMilliseconds);
      processObservationComplete = true;
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (processObservationComplete) {
      try { await rm(root, { recursive: true, force: true }); } catch (error) { cleanupErrors.push(error); }
    }
    if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, "Synthetic process-tree cleanup did not complete safely.");
  }
});

test("canonical state ownership rejects symlinks and cleanup rejects nested junctions", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "ecdlink-state-safety-"));
  const owned = join(root, "owned");
  await mkdir(owned);
  const state = join(owned, "integration-state.json");
  await writeFile(state, "{}\n");
  try {
    assert.equal((await verifyCanonicalOwnedStatePath(state, owned, tmpdir())).statePath, await realpath(state));
    const linkedState = join(owned, "linked-state.json");
    try {
      await symlink(state, linkedState, "file");
      await assert.rejects(() => verifyCanonicalOwnedStatePath(linkedState, owned, tmpdir()), /regular file/i);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") context.diagnostic("File symlink creation is unavailable on this Windows host.");
      else throw error;
    }
    await rm(linkedState, { force: true });
    const target = join(root, "junction-target");
    await mkdir(target);
    const junction = join(owned, "junction");
    try {
      await symlink(target, junction, process.platform === "win32" ? "junction" : "dir");
      await assert.rejects(() => assertNoLinksRecursively(owned), /symbolic link or junction/i);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") context.diagnostic("Junction creation is unavailable on this Windows host.");
      else throw error;
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
