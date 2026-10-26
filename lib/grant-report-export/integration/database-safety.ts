import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export const DISPOSABLE_DATABASE_APPROVAL = "I_APPROVE_ECDLINK_DISPOSABLE_POSTGRES_MUTATION";
export const DISPOSABLE_DATABASE_PURPOSE = "ECDLINK_EXPORT_INTEGRATION_ONLY";
export const DISPOSABLE_CONTAINER_PURPOSE_LABEL = "com.ecdlink.purpose";
export const DISPOSABLE_CONTAINER_RUN_LABEL = "com.ecdlink.run-id";
export const PROVISIONAL_POSTGRES_MAJOR = 18;

const RUN_ID_PATTERN = /^[a-f0-9]{32}$/;
const NONCE_PATTERN = /^[a-f0-9]{64}$/;
const STATE_PROOF_PATTERN = /^[a-f0-9]{64}$/;
const CONTAINER_ID_PATTERN = /^[a-f0-9]{64}$/;
const IMAGE_PATTERN = /^postgres:(\d+)\.\d+-alpine\d+\.\d+@sha256:[a-f0-9]{64}$/;

export class DisposableDatabaseSafetyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DisposableDatabaseSafetyError";
  }
}

export type DatabaseTarget = {
  hostname: string;
  port: number;
  databaseName: string;
  username: string;
};

export type DisposableDatabasePlan = {
  approval: string;
  runId: string;
  nonce: string;
  databaseName: string;
  fullHistoryDatabaseName: string;
  containerName: string;
  postgresImage: string;
  confirmedProductionPostgresMajor: number;
  temporaryRoot: string;
  operatingSystemTemporaryRoot: string;
  stateProof?: string;
};

export type DisposableDatabaseConnectionPlan = DisposableDatabasePlan & {
  integrationDatabaseUrl: string;
  integrationDirectUrl: string;
  expectedHost: "127.0.0.1";
  expectedPort: number;
};

export type ObservedContainerIdentity = {
  id: string;
  name: string;
  image: string;
  running: boolean;
  labels: Record<string, string | undefined>;
  hostIp: string;
  hostPort: number;
  postgresDatabase: string;
  postgresUser: string;
};

export type ObservedPreSentinelDatabaseIdentity = {
  databaseName: string;
  databaseUser: string;
  serverAddress: string;
  serverPort: number;
};

export type ObservedDatabaseIdentity = {
  databaseName: string;
  databaseUser: string;
  serverAddress: string;
  serverPort: number;
  purpose: string;
  runId: string;
  nonce: string;
};

export type DockerBoundDisposableDatabasePlan = DisposableDatabaseConnectionPlan & {
  containerId: string;
};

export type DockerContainerInspector = (containerId: string) => Promise<ObservedContainerIdentity>;

function fail(code: string, message: string): never {
  throw new DisposableDatabaseSafetyError(code, message);
}

function assertExactApproval(value: string) {
  if (value !== DISPOSABLE_DATABASE_APPROVAL) {
    fail("APPROVAL_REQUIRED", "Disposable database mutation was not explicitly approved.");
  }
}

function assertRunIdentity(runId: string, nonce: string) {
  if (!RUN_ID_PATTERN.test(runId)) fail("INVALID_RUN_ID", "The disposable database run identifier is invalid.");
  if (!NONCE_PATTERN.test(nonce)) fail("INVALID_NONCE", "The disposable database identity nonce is invalid.");
}

export function assertStateProof(value: string) {
  if (!STATE_PROOF_PATTERN.test(value)) fail("INVALID_STATE_PROOF", "The disposable run-state proof is invalid.");
}

function expectedDatabaseName(runId: string) {
  return `ecdlink_export_it_${runId}`;
}

function expectedFullHistoryDatabaseName(runId: string) {
  return `ecdlink_export_full_it_${runId}`;
}

function expectedContainerName(runId: string) {
  return `ecdlink-export-it-${runId}`;
}

function parseDatabaseUrl(value: string, field: string): DatabaseTarget {
  if (!value) fail("MISSING_DATABASE_URL", `${field} is required and has no fallback.`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fail("INVALID_DATABASE_URL", `${field} is not a valid PostgreSQL URL.`);
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail("INVALID_DATABASE_URL", `${field} must use the PostgreSQL protocol.`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname)) {
    fail("EXTERNAL_DATABASE_REJECTED", `${field} must target an explicitly approved loopback host.`);
  }
  if (/neon|production|prod\b|staging|stage\b/i.test(hostname)) {
    fail("MANAGED_DATABASE_REJECTED", `${field} resembles a managed, production, or staging endpoint.`);
  }
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    fail("INVALID_DATABASE_PORT", `${field} must specify the approved randomly allocated host port.`);
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!databaseName || databaseName.includes("/") || databaseName.includes("\\")) {
    fail("INVALID_DATABASE_NAME", `${field} contains an invalid database name.`);
  }
  if (!parsed.username || !parsed.password) {
    fail("MISSING_DATABASE_CREDENTIALS", `${field} must contain the generated disposable credentials.`);
  }
  return { hostname, port, databaseName, username: decodeURIComponent(parsed.username) };
}

function normalizeHost(hostname: string) {
  return hostname === "localhost" || hostname === "[::1]" || hostname === "::1" ? "127.0.0.1" : hostname;
}

function assertSameTarget(runtime: DatabaseTarget, direct: DatabaseTarget) {
  if (
    normalizeHost(runtime.hostname) !== normalizeHost(direct.hostname)
    || runtime.port !== direct.port
    || runtime.databaseName !== direct.databaseName
    || runtime.username !== direct.username
  ) {
    fail("DATABASE_TARGET_MISMATCH", "Runtime and migration URLs do not identify the same disposable database target.");
  }
}

function assertTemporaryRoot(temporaryRoot: string, operatingSystemTemporaryRoot: string, runId: string) {
  const root = resolve(temporaryRoot);
  const osRoot = resolve(operatingSystemTemporaryRoot);
  const relativePath = relative(osRoot, root);
  if (!isAbsolute(root) || !relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    fail("UNSAFE_TEMPORARY_ROOT", "The disposable working directory is outside the operating-system temporary directory.");
  }
  if (!root.endsWith(expectedContainerName(runId))) {
    fail("UNSAFE_TEMPORARY_ROOT", "The disposable working directory does not belong to the exact integration run.");
  }
}

export function validateDisposableDatabasePlan(plan: DisposableDatabasePlan) {
  assertExactApproval(plan.approval);
  assertRunIdentity(plan.runId, plan.nonce);
  if (plan.databaseName !== expectedDatabaseName(plan.runId)) fail("INVALID_DATABASE_NAME", "The primary database name does not match the run identifier.");
  if (plan.fullHistoryDatabaseName !== expectedFullHistoryDatabaseName(plan.runId)) fail("INVALID_DATABASE_NAME", "The full-history database name does not match the run identifier.");
  if (plan.containerName !== expectedContainerName(plan.runId)) fail("INVALID_CONTAINER_NAME", "The Docker container name does not match the run identifier.");
  if (plan.confirmedProductionPostgresMajor !== PROVISIONAL_POSTGRES_MAJOR) {
    fail("POSTGRES_MAJOR_UNCONFIRMED", "The confirmed production PostgreSQL major must match the provisionally supported harness major.");
  }
  const imageMatch = IMAGE_PATTERN.exec(plan.postgresImage);
  if (!imageMatch || Number(imageMatch[1]) !== plan.confirmedProductionPostgresMajor) {
    fail("UNPINNED_POSTGRES_IMAGE", "The PostgreSQL image must include an approved patch tag, Alpine version, and SHA-256 digest for the confirmed major.");
  }
  assertTemporaryRoot(plan.temporaryRoot, plan.operatingSystemTemporaryRoot, plan.runId);
  return plan;
}

export function validateDisposableDatabaseConnections(plan: DisposableDatabaseConnectionPlan) {
  validateDisposableDatabasePlan(plan);
  if (plan.expectedHost !== "127.0.0.1") fail("EXTERNAL_DATABASE_REJECTED", "The approved database host must be IPv4 loopback.");
  if (!Number.isInteger(plan.expectedPort) || plan.expectedPort < 1024 || plan.expectedPort > 65535) {
    fail("INVALID_DATABASE_PORT", "The approved database port is invalid.");
  }
  const runtime = parseDatabaseUrl(plan.integrationDatabaseUrl, "INTEGRATION_DATABASE_URL");
  const direct = parseDatabaseUrl(plan.integrationDirectUrl, "INTEGRATION_DIRECT_URL");
  assertSameTarget(runtime, direct);
  if (normalizeHost(runtime.hostname) !== plan.expectedHost || runtime.port !== plan.expectedPort) {
    fail("DATABASE_TARGET_MISMATCH", "The database URLs do not match the verified Docker loopback binding.");
  }
  if (runtime.databaseName !== plan.databaseName) fail("INVALID_DATABASE_NAME", "The database URL does not target the generated database name.");
  return { plan, runtime, direct };
}

export function validateObservedContainer(plan: DisposableDatabaseConnectionPlan, observed: ObservedContainerIdentity) {
  validateDisposableDatabaseConnections(plan);
  if (!CONTAINER_ID_PATTERN.test(observed.id)) fail("INVALID_CONTAINER_ID", "The Docker container identity is invalid.");
  if (observed.name !== plan.containerName) fail("CONTAINER_IDENTITY_MISMATCH", "The Docker container name does not match the run.");
  if (observed.image !== plan.postgresImage) fail("CONTAINER_IDENTITY_MISMATCH", "The running PostgreSQL image does not match the approved pinned image.");
  if (!observed.running) fail("CONTAINER_IDENTITY_MISMATCH", "The disposable PostgreSQL container is not running.");
  if (observed.labels[DISPOSABLE_CONTAINER_PURPOSE_LABEL] !== DISPOSABLE_DATABASE_PURPOSE) {
    fail("CONTAINER_LABEL_MISMATCH", "The Docker container is not labelled for ECDLink disposable export integration.");
  }
  if (observed.labels[DISPOSABLE_CONTAINER_RUN_LABEL] !== plan.runId) {
    fail("CONTAINER_LABEL_MISMATCH", "The Docker container run label does not match the active run.");
  }
  if (observed.hostIp !== plan.expectedHost || observed.hostPort !== plan.expectedPort) {
    fail("CONTAINER_BINDING_MISMATCH", "The Docker PostgreSQL port is not bound to the verified loopback endpoint.");
  }
  if (observed.postgresDatabase !== plan.databaseName || observed.postgresUser !== "ecdlink_it") {
    fail("CONTAINER_IDENTITY_MISMATCH", "The running PostgreSQL bootstrap identity does not match the disposable run.");
  }
  return observed;
}

export function validatePreSentinelDatabaseIdentity(
  plan: DisposableDatabaseConnectionPlan,
  observed: ObservedPreSentinelDatabaseIdentity,
  expectedDatabase = plan.databaseName,
) {
  validateDisposableDatabasePlan(plan);
  const runtime = parseDatabaseUrl(replaceDatabaseName(plan.integrationDatabaseUrl, expectedDatabase), "INTEGRATION_DATABASE_URL");
  const direct = parseDatabaseUrl(replaceDatabaseName(plan.integrationDirectUrl, expectedDatabase), "INTEGRATION_DIRECT_URL");
  assertSameTarget(runtime, direct);
  if (normalizeHost(runtime.hostname) !== plan.expectedHost || runtime.port !== plan.expectedPort || runtime.databaseName !== expectedDatabase) {
    fail("DATABASE_TARGET_MISMATCH", "The pre-sentinel database is not associated with the verified Docker endpoint.");
  }
  if (observed.databaseName !== expectedDatabase || observed.databaseUser !== "ecdlink_it") {
    fail("DATABASE_IDENTITY_MISMATCH", "The pre-sentinel PostgreSQL database or user does not match the disposable run.");
  }
  if (!["127.0.0.1", "::1"].includes(observed.serverAddress) || observed.serverPort !== 5432) {
    fail("DATABASE_IDENTITY_MISMATCH", "The pre-sentinel PostgreSQL server identity is unexpected.");
  }
  return observed;
}

export function validateObservedDatabase(
  plan: DisposableDatabaseConnectionPlan,
  observed: ObservedDatabaseIdentity,
  expectedDatabase = plan.databaseName,
) {
  validateDisposableDatabasePlan(plan);
  const runtime = parseDatabaseUrl(replaceDatabaseName(plan.integrationDatabaseUrl, expectedDatabase), "INTEGRATION_DATABASE_URL");
  const direct = parseDatabaseUrl(replaceDatabaseName(plan.integrationDirectUrl, expectedDatabase), "INTEGRATION_DIRECT_URL");
  assertSameTarget(runtime, direct);
  if (normalizeHost(runtime.hostname) !== plan.expectedHost || runtime.port !== plan.expectedPort || runtime.databaseName !== expectedDatabase) {
    fail("DATABASE_TARGET_MISMATCH", "The observed database is not associated with the verified Docker endpoint.");
  }
  if (observed.databaseName !== expectedDatabase) fail("DATABASE_IDENTITY_MISMATCH", "The connected database name is not the approved disposable target.");
  if (observed.databaseUser !== "ecdlink_it") fail("DATABASE_IDENTITY_MISMATCH", "The connected PostgreSQL user is not the approved disposable identity.");
  if (!["127.0.0.1", "::1"].includes(observed.serverAddress)) fail("DATABASE_IDENTITY_MISMATCH", "The PostgreSQL server is not local to the verified Docker environment.");
  if (observed.serverPort !== 5432) fail("DATABASE_IDENTITY_MISMATCH", "The PostgreSQL server port inside the container is unexpected.");
  if (observed.purpose !== DISPOSABLE_DATABASE_PURPOSE) fail("SENTINEL_MISMATCH", "The database identity sentinel purpose is invalid.");
  if (observed.runId !== plan.runId) fail("SENTINEL_MISMATCH", "The database identity sentinel run identifier is invalid.");
  if (observed.nonce !== plan.nonce) fail("SENTINEL_MISMATCH", "The database identity sentinel nonce is invalid.");
  return observed;
}

export function parseDockerInspection(value: string): ObservedContainerIdentity {
  let parsed: Array<{
    Id?: unknown;
    Name?: unknown;
    State?: { Running?: unknown };
    Config?: { Image?: unknown; Labels?: Record<string, string>; Env?: string[] };
    NetworkSettings?: { Ports?: Record<string, Array<{ HostIp?: unknown; HostPort?: unknown }> | null> };
  }>;
  try {
    parsed = JSON.parse(value) as typeof parsed;
  } catch {
    return fail("DOCKER_ATTESTATION_FAILED", "Docker returned an invalid container inspection response.");
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    fail("DOCKER_ATTESTATION_FAILED", "The Docker container identity is missing or ambiguous.");
  }
  const item = parsed[0];
  const bindings = item.NetworkSettings?.Ports?.["5432/tcp"] ?? [];
  if (bindings.length !== 1) fail("DOCKER_ATTESTATION_FAILED", "The Docker PostgreSQL port binding is missing or ambiguous.");
  const containerEnvironment = new Map((item.Config?.Env ?? []).map((entry) => {
    const separator = entry.indexOf("=");
    return separator < 0 ? [entry, ""] : [entry.slice(0, separator), entry.slice(separator + 1)];
  }));
  return {
    id: typeof item.Id === "string" ? item.Id : "",
    name: typeof item.Name === "string" ? item.Name.replace(/^\//, "") : "",
    image: typeof item.Config?.Image === "string" ? item.Config.Image : "",
    running: item.State?.Running === true,
    labels: item.Config?.Labels ?? {},
    hostIp: typeof bindings[0].HostIp === "string" ? bindings[0].HostIp : "",
    hostPort: Number(bindings[0].HostPort),
    postgresDatabase: containerEnvironment.get("POSTGRES_DB") ?? "",
    postgresUser: containerEnvironment.get("POSTGRES_USER") ?? "",
  };
}

export async function verifyLiveDockerAttestation(
  plan: DockerBoundDisposableDatabasePlan,
  inspect: DockerContainerInspector,
  timeoutMilliseconds = 15_000,
) {
  validateDisposableDatabaseConnections(plan);
  if (!CONTAINER_ID_PATTERN.test(plan.containerId)) fail("INVALID_CONTAINER_ID", "The approved Docker container identity is invalid.");
  if (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 || timeoutMilliseconds > 30_000) {
    fail("DOCKER_ATTESTATION_FAILED", "The Docker inspection timeout is invalid.");
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const observed = await Promise.race([
      inspect(plan.containerId),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new DisposableDatabaseSafetyError("DOCKER_ATTESTATION_FAILED", "Docker inspection exceeded its bounded execution time.")), timeoutMilliseconds);
      }),
    ]);
    if (observed.id !== plan.containerId) fail("CONTAINER_IDENTITY_MISMATCH", "The live Docker container ID does not match the approved run state.");
    return validateObservedContainer(plan, observed);
  } catch (error) {
    if (error instanceof DisposableDatabaseSafetyError) throw error;
    return fail("DOCKER_ATTESTATION_FAILED", "The live Docker container could not be independently verified.");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function validateCleanupTarget(plan: DisposableDatabaseConnectionPlan, observed: ObservedContainerIdentity) {
  validateObservedContainer(plan, observed);
  assertTemporaryRoot(plan.temporaryRoot, plan.operatingSystemTemporaryRoot, plan.runId);
  return { containerId: observed.id, temporaryRoot: resolve(plan.temporaryRoot) };
}

export function replaceDatabaseName(value: string, databaseName: string) {
  const parsed = new URL(value);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

export function withSingleConnectionLimit(value: string) {
  const parsed = new URL(value);
  parsed.searchParams.set("connection_limit", "1");
  return parsed.toString();
}

const SAFE_INHERITED_ENVIRONMENT_KEYS = new Set([
  "APPDATA", "CI", "FORCE_COLOR", "HOME", "LOCALAPPDATA", "NO_COLOR", "NUMBER_OF_PROCESSORS",
  "PATH", "PATHEXT", "PROCESSOR_ARCHITECTURE", "PROGRAMDATA", "SYSTEMDRIVE", "SYSTEMROOT", "TEMP",
  "TERM", "TMP", "TMPDIR", "USERPROFILE", "WINDIR",
]);

const PROTECTED_CHILD_KEYS = new Set([
  "DATABASE_URL", "DIRECT_URL", "INTEGRATION_DATABASE_URL", "INTEGRATION_DIRECT_URL",
  "ECDLINK_ALLOW_DISPOSABLE_DB_TESTS", "ECDLINK_INTEGRATION_RUN_ID", "ECDLINK_INTEGRATION_NONCE",
  "ECDLINK_INTEGRATION_DATABASE_NAME", "ECDLINK_INTEGRATION_CONTAINER_ID",
  "ECDLINK_INTEGRATION_STATE_PATH", "ECDLINK_INTEGRATION_STATE_PROOF",
]);

export function createSafeChildEnvironment(
  source: Record<string, string | undefined>,
  additions: Record<string, string | undefined> = {},
) {
  const environment: Record<string, string> = {};
  for (const key of SAFE_INHERITED_ENVIRONMENT_KEYS) {
    if (source[key] !== undefined) environment[key] = source[key]!;
  }
  for (const [key, value] of Object.entries(additions)) {
    if (value === undefined) continue;
    if (/^PRISMA_/i.test(key) || key === "NODE_OPTIONS") {
      fail("UNSAFE_CHILD_ENVIRONMENT", `The child environment contains a prohibited ${key} override.`);
    }
    environment[key] = value;
  }
  return environment;
}

export function createDisposableChildEnvironment(
  source: Record<string, string | undefined>,
  validated: Record<string, string>,
  extras: Record<string, string | undefined> = {},
) {
  for (const key of Object.keys(extras)) {
    if (PROTECTED_CHILD_KEYS.has(key) || /^PRISMA_/i.test(key) || key === "NODE_OPTIONS") {
      fail("UNSAFE_CHILD_ENVIRONMENT", `The extra child environment cannot override ${key}.`);
    }
  }
  return createSafeChildEnvironment(source, { ...extras, ...validated });
}

export async function verifyCanonicalOwnedStatePath(statePath: string, temporaryRoot: string, operatingSystemTemporaryRoot: string) {
  const resolvedState = resolve(statePath);
  const resolvedOsRoot = resolve(await realpath(resolve(operatingSystemTemporaryRoot)));
  const stateStat = await lstat(resolvedState);
  if (!stateStat.isFile() || stateStat.isSymbolicLink()) fail("UNSAFE_STATE_PATH", "The integration state path is not an owned regular file.");
  const canonicalState = resolve(await realpath(resolvedState));
  const stateRelativeToTemporaryRoot = relative(resolvedOsRoot, canonicalState);
  if (!stateRelativeToTemporaryRoot || stateRelativeToTemporaryRoot.startsWith("..") || isAbsolute(stateRelativeToTemporaryRoot)) {
    fail("UNSAFE_STATE_PATH", "The integration state path failed canonical temporary-root verification.");
  }
  const root = resolve(temporaryRoot);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail("UNSAFE_TEMPORARY_ROOT", "The integration temporary root is not an owned directory.");
  const canonicalRoot = resolve(await realpath(root));
  const rootRelativeToTemporaryRoot = relative(resolvedOsRoot, canonicalRoot);
  if (!rootRelativeToTemporaryRoot || rootRelativeToTemporaryRoot.startsWith("..") || isAbsolute(rootRelativeToTemporaryRoot) || dirname(canonicalState) !== canonicalRoot) {
    fail("UNSAFE_TEMPORARY_ROOT", "The integration temporary root failed canonical ownership verification.");
  }
  return { statePath: canonicalState, temporaryRoot: canonicalRoot };
}

export function redactSensitiveDiagnostic(value: unknown) {
  let text = value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  text = text.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, "[REDACTED_POSTGRES_URL]");
  text = text.replace(/(password|token|secret|authorization)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]");
  return text;
}

export function hashMigrationBytes(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isDisposableIntegrationExecutionRequested(environment: Record<string, string | undefined> = process.env) {
  return environment.ECDLINK_ALLOW_DISPOSABLE_DB_TESTS === DISPOSABLE_DATABASE_APPROVAL;
}

export function assertDedicatedIntegrationEnvironment(environment: Record<string, string | undefined> = process.env) {
  assertExactApproval(environment.ECDLINK_ALLOW_DISPOSABLE_DB_TESTS ?? "");
  if (!environment.INTEGRATION_DATABASE_URL || !environment.INTEGRATION_DIRECT_URL) {
    fail("MISSING_DATABASE_URL", "Dedicated integration database URLs are required.");
  }
  if (environment.INTEGRATION_DATABASE_URL === environment.DATABASE_URL || environment.INTEGRATION_DIRECT_URL === environment.DIRECT_URL) {
    fail("CONNECTION_FALLBACK_REJECTED", "Integration database URLs must not reuse inherited application database URLs.");
  }
  const runtime = parseDatabaseUrl(environment.INTEGRATION_DATABASE_URL, "INTEGRATION_DATABASE_URL");
  const direct = parseDatabaseUrl(environment.INTEGRATION_DIRECT_URL, "INTEGRATION_DIRECT_URL");
  assertSameTarget(runtime, direct);
  return {
    databaseUrl: environment.INTEGRATION_DATABASE_URL,
    directUrl: environment.INTEGRATION_DIRECT_URL,
    target: runtime,
  };
}
