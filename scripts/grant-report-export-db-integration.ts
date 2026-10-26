import { randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { chmod, copyFile, cp, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  assertDedicatedIntegrationEnvironment,
  assertStateProof,
  createDisposableChildEnvironment,
  createSafeChildEnvironment,
  DISPOSABLE_CONTAINER_PURPOSE_LABEL,
  DISPOSABLE_CONTAINER_RUN_LABEL,
  DISPOSABLE_DATABASE_APPROVAL,
  DISPOSABLE_DATABASE_PURPOSE,
  hashMigrationBytes,
  parseDockerInspection,
  redactSensitiveDiagnostic,
  replaceDatabaseName,
  validateCleanupTarget,
  validateDisposableDatabasePlan,
  validateObservedContainer,
  validateObservedDatabase,
  validatePreSentinelDatabaseIdentity,
  verifyCanonicalOwnedStatePath,
  type DisposableDatabaseConnectionPlan,
  type ObservedContainerIdentity,
  type ObservedDatabaseIdentity,
  type ObservedPreSentinelDatabaseIdentity,
} from "../lib/grant-report-export/integration/database-safety";

const C2B1_MIGRATION = "20261012120000_grant_report_export_artifacts";
const OUTBOX_MIGRATION = "20261013120000_grant_report_export_outbox";
const STATE_FILENAME = "integration-state.json";
const POSTGRES_USER = "ecdlink_it";

type Mode = "prepare" | "test" | "cleanup";

type HarnessState = DisposableDatabaseConnectionPlan & {
  containerId: string;
  dockerExecutablePath: string;
  postgresUser: string;
  postgresPassword: string;
  statePath: string;
  createdAt: string;
  stateProof: string;
};

type CommandResult = { stdout: string; stderr: string };
const PROCESS_TREE_TERMINATION_TIMEOUT_MS = 5_000;
const PROCESS_TREE_DIAGNOSTIC_LIMIT_BYTES = 4_096;
export const GENERAL_COMMAND_OUTPUT_LIMIT_BYTES = 1_048_576;
const WINDOWS_TASKKILL_EXECUTABLES = Object.freeze({
  ia32: "C:\\Windows\\Sysnative\\taskkill.exe",
  x64: "C:\\Windows\\System32\\taskkill.exe",
  arm64: "C:\\Windows\\System32\\taskkill.exe",
});
const WINDOWS_ICACLS_EXECUTABLES = Object.freeze({
  ia32: "C:\\Windows\\Sysnative\\icacls.exe",
  x64: "C:\\Windows\\System32\\icacls.exe",
  arm64: "C:\\Windows\\System32\\icacls.exe",
});
const WINDOWS_WHOAMI_EXECUTABLES = Object.freeze({
  ia32: "C:\\Windows\\Sysnative\\whoami.exe",
  x64: "C:\\Windows\\System32\\whoami.exe",
  arm64: "C:\\Windows\\System32\\whoami.exe",
});

const WINDOWS_DOCKER_EXECUTABLES = Object.freeze([
  "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
  "C:\\ProgramData\\DockerDesktop\\version-bin\\docker.exe",
]);
const POSIX_DOCKER_EXECUTABLES = Object.freeze([
  "/usr/bin/docker",
  "/usr/local/bin/docker",
  "/opt/homebrew/bin/docker",
]);

type TrustedExecutableObservation = {
  isFile: boolean;
  isSymbolicLink: boolean;
  canonicalPath: string;
};

type TrustedExecutableProbe = (path: string) => Promise<TrustedExecutableObservation | null>;

export type WindowsTaskkillDiagnostic = Readonly<{
  classification: "nonzero_exit" | "signal" | "spawn_error" | "timeout";
  executable: "trusted_system32" | "trusted_sysnative";
  arguments: readonly ["/PID", "[OWNED_CHILD_PID]", "/T", "/F"];
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  elapsedMilliseconds: number;
  stdout: string;
  stderr: string;
}>;

export class WindowsProcessTreeTerminationError extends Error {
  constructor(public readonly diagnostic: WindowsTaskkillDiagnostic) {
    super(`The timed-out Windows process tree could not be terminated: ${JSON.stringify(diagnostic)}`);
    this.name = "WindowsProcessTreeTerminationError";
  }
}

function isStrictlyWithin(parent: string, candidate: string) {
  const relativePath = relative(resolve(parent), resolve(candidate));
  return relativePath !== "" && relativePath !== ".." && !relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(relativePath);
}

function appendBoundedDiagnostic(current: Buffer, chunk: Buffer) {
  const remaining = PROCESS_TREE_DIAGNOSTIC_LIMIT_BYTES - current.byteLength;
  return remaining <= 0 ? current : Buffer.concat([current, chunk.subarray(0, remaining)]);
}

export type BoundedOutputCapture = {
  chunks: Map<number, Buffer>;
  headIndex: number;
  nextIndex: number;
  retainedBytes: number;
  totalBytes: number;
  truncated: boolean;
};

export function createBoundedOutputCapture(): BoundedOutputCapture {
  return { chunks: new Map(), headIndex: 0, nextIndex: 0, retainedBytes: 0, totalBytes: 0, truncated: false };
}

export function appendBoundedOutput(capture: BoundedOutputCapture, chunk: Buffer) {
  capture.totalBytes += chunk.byteLength;
  if (chunk.byteLength >= GENERAL_COMMAND_OUTPUT_LIMIT_BYTES) {
    capture.chunks = new Map([[0, Buffer.from(chunk.subarray(chunk.byteLength - GENERAL_COMMAND_OUTPUT_LIMIT_BYTES))]]);
    capture.headIndex = 0;
    capture.nextIndex = 1;
    capture.retainedBytes = GENERAL_COMMAND_OUTPUT_LIMIT_BYTES;
  } else {
    capture.chunks.set(capture.nextIndex, chunk);
    capture.nextIndex += 1;
    capture.retainedBytes += chunk.byteLength;
    let excess = capture.retainedBytes - GENERAL_COMMAND_OUTPUT_LIMIT_BYTES;
    while (excess > 0) {
      const head = capture.chunks.get(capture.headIndex);
      if (!head) throw new Error("The bounded command-output capture is internally inconsistent.");
      if (excess >= head.byteLength) {
        excess -= head.byteLength;
        capture.retainedBytes -= head.byteLength;
        capture.chunks.delete(capture.headIndex);
        capture.headIndex += 1;
      } else {
        capture.chunks.set(capture.headIndex, Buffer.from(head.subarray(excess)));
        capture.retainedBytes -= excess;
        excess = 0;
      }
    }
  }
  capture.truncated = capture.totalBytes > GENERAL_COMMAND_OUTPUT_LIMIT_BYTES;
}

export function renderBoundedOutput(capture: BoundedOutputCapture) {
  const retained = [...capture.chunks.values()];
  const output = (retained.length === 0
    ? Buffer.alloc(0)
    : retained.length === 1
      ? retained[0]
      : Buffer.concat(retained, capture.retainedBytes)).toString("utf8");
  return capture.truncated
    ? `[output truncated; retained final ${GENERAL_COMMAND_OUTPUT_LIMIT_BYTES} bytes]\n${output}`
    : output;
}

export function sanitizeWindowsTerminationOutput(value: Buffer) {
  return redactSensitiveDiagnostic(value.toString("utf8")).slice(0, PROCESS_TREE_DIAGNOSTIC_LIMIT_BYTES);
}

export function classifyWindowsTaskkillFailure(input: Omit<WindowsTaskkillDiagnostic, "classification"> & { spawnError?: unknown }) {
  const classification: WindowsTaskkillDiagnostic["classification"] = input.spawnError
    ? "spawn_error"
    : input.timedOut
      ? "timeout"
      : input.signal
        ? "signal"
        : "nonzero_exit";
  return new WindowsProcessTreeTerminationError({
    classification,
    executable: input.executable,
    arguments: input.arguments,
    exitCode: input.exitCode,
    signal: input.signal,
    timedOut: input.timedOut,
    elapsedMilliseconds: input.elapsedMilliseconds,
    stdout: input.stdout,
    stderr: input.spawnError
      ? redactSensitiveDiagnostic(input.spawnError).slice(0, PROCESS_TREE_DIAGNOSTIC_LIMIT_BYTES)
      : input.stderr,
  });
}

export function trustedTaskkillExecutableCandidate(platform: NodeJS.Platform, architecture: string) {
  if (platform !== "win32") throw new Error("Trusted taskkill resolution is only available on Windows.");
  const candidate = WINDOWS_TASKKILL_EXECUTABLES[architecture as keyof typeof WINDOWS_TASKKILL_EXECUTABLES];
  if (!candidate) throw new Error("This Windows architecture has no approved taskkill executable location.");
  return candidate;
}

export async function resolveTrustedTaskkillExecutableForPlatform(
  platform: NodeJS.Platform,
  architecture: string,
  probe: TrustedExecutableProbe = inspectTrustedExecutable,
) {
  const candidate = trustedTaskkillExecutableCandidate(platform, architecture);
  const observation = await probe(candidate);
  if (!observation?.isFile || observation.isSymbolicLink) {
    throw new Error("The trusted Windows taskkill executable is unavailable or unsafe.");
  }
  if (resolve(observation.canonicalPath).toLowerCase() !== resolve(candidate).toLowerCase()) {
    throw new Error("The trusted Windows taskkill executable failed canonical-path verification.");
  }
  return candidate;
}

export function trustedIcaclsExecutableCandidate(platform: NodeJS.Platform, architecture: string) {
  if (platform !== "win32") throw new Error("Trusted icacls resolution is only available on Windows.");
  const candidate = WINDOWS_ICACLS_EXECUTABLES[architecture as keyof typeof WINDOWS_ICACLS_EXECUTABLES];
  if (!candidate) throw new Error("This Windows architecture has no approved icacls executable location.");
  return candidate;
}

export async function resolveTrustedIcaclsExecutableForPlatform(
  platform: NodeJS.Platform,
  architecture: string,
  probe: TrustedExecutableProbe = inspectTrustedExecutable,
) {
  const candidate = trustedIcaclsExecutableCandidate(platform, architecture);
  const observation = await probe(candidate);
  if (!observation?.isFile || observation.isSymbolicLink) {
    throw new Error("The trusted Windows icacls executable is unavailable or unsafe.");
  }
  if (resolve(observation.canonicalPath).toLowerCase() !== resolve(candidate).toLowerCase()) {
    throw new Error("The trusted Windows icacls executable failed canonical-path verification.");
  }
  return candidate;
}

export function trustedWhoamiExecutableCandidate(platform: NodeJS.Platform, architecture: string) {
  if (platform !== "win32") throw new Error("Trusted whoami resolution is only available on Windows.");
  const candidate = WINDOWS_WHOAMI_EXECUTABLES[architecture as keyof typeof WINDOWS_WHOAMI_EXECUTABLES];
  if (!candidate) throw new Error("This Windows architecture has no approved whoami executable location.");
  return candidate;
}

export async function resolveTrustedWhoamiExecutableForPlatform(
  platform: NodeJS.Platform,
  architecture: string,
  probe: TrustedExecutableProbe = inspectTrustedExecutable,
) {
  const candidate = trustedWhoamiExecutableCandidate(platform, architecture);
  const observation = await probe(candidate);
  if (!observation?.isFile || observation.isSymbolicLink) {
    throw new Error("The trusted Windows whoami executable is unavailable or unsafe.");
  }
  if (resolve(observation.canonicalPath).toLowerCase() !== resolve(candidate).toLowerCase()) {
    throw new Error("The trusted Windows whoami executable failed canonical-path verification.");
  }
  return candidate;
}

export function validateWindowsSid(value: string) {
  if (!/^S-1-(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*)){1,15}$/.test(value)) {
    throw new Error("The current Windows process SID is missing or invalid.");
  }
  const [, , authority, ...subAuthorities] = value.split("-");
  if (Number(authority) > 281_474_976_710_655
    || subAuthorities.some((component) => Number(component) > 4_294_967_295)) {
    throw new Error("The current Windows process SID is missing or invalid.");
  }
  return value;
}

export function parseWhoamiUserSidOutput(value: string) {
  const match = /^"(?:[^"\r\n]|"")*","([^"\r\n]+)"$/.exec(value.trim());
  if (!match) throw new Error("The trusted Windows identity output is missing or malformed.");
  return validateWindowsSid(match[1]);
}

export async function resolveCurrentWindowsProcessSid(
  platform: NodeJS.Platform,
  architecture: string,
  probe: TrustedExecutableProbe = inspectTrustedExecutable,
  execute: typeof runCommand = runCommand,
) {
  const executable = await resolveTrustedWhoamiExecutableForPlatform(platform, architecture, probe);
  const result = await execute(executable, ["/user", "/fo", "csv", "/nh"], { timeoutMilliseconds: 10_000 });
  return parseWhoamiUserSidOutput(result.stdout);
}

async function terminateProcessTree(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    const taskkillExecutable = await resolveTrustedTaskkillExecutableForPlatform(process.platform, process.arch);
    await new Promise<void>((resolvePromise, reject) => {
      const startedAt = performance.now();
      const diagnosticBase = {
        executable: taskkillExecutable.includes("Sysnative") ? "trusted_sysnative" as const : "trusted_system32" as const,
        arguments: ["/PID", "[OWNED_CHILD_PID]", "/T", "/F"] as const,
      };
      let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      let settled = false;
      const settleFailure = (details: {
        exitCode: number | null;
        signal: NodeJS.Signals | null;
        timedOut: boolean;
        spawnError?: unknown;
      }) => {
        if (settled) return;
        settled = true;
        reject(classifyWindowsTaskkillFailure({
          ...diagnosticBase,
          ...details,
          elapsedMilliseconds: Number((performance.now() - startedAt).toFixed(1)),
          stdout: sanitizeWindowsTerminationOutput(stdout),
          stderr: sanitizeWindowsTerminationOutput(stderr),
        }));
      };
      const terminator = spawn(taskkillExecutable, ["/PID", String(child.pid), "/T", "/F"], {
        env: createSafeChildEnvironment(process.env) as NodeJS.ProcessEnv,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      terminator.stdout?.on("data", (chunk: Buffer) => { stdout = appendBoundedDiagnostic(stdout, chunk); });
      terminator.stderr?.on("data", (chunk: Buffer) => { stderr = appendBoundedDiagnostic(stderr, chunk); });
      const terminationTimeout = setTimeout(() => {
        terminator.kill();
        settleFailure({ exitCode: null, signal: null, timedOut: true });
      }, PROCESS_TREE_TERMINATION_TIMEOUT_MS);
      terminator.once("error", (error) => {
        clearTimeout(terminationTimeout);
        settleFailure({ exitCode: null, signal: null, timedOut: false, spawnError: error });
      });
      terminator.once("close", (code, signal) => {
        clearTimeout(terminationTimeout);
        if (settled) return;
        if (code === 0) {
          settled = true;
          resolvePromise();
          return;
        }
        settleFailure({ exitCode: code, signal, timedOut: false });
      });
    });
    return;
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch { if (child.exitCode === null) throw new Error("The timed-out process group could not be terminated."); }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  if (child.exitCode === null) {
    try { process.kill(-child.pid, "SIGKILL"); } catch { if (child.exitCode === null) throw new Error("The timed-out process group could not be killed."); }
  }
}

export async function runCommand(
  command: string,
  args: string[],
  options: { environment?: Record<string, string | undefined>; cwd?: string; timeoutMilliseconds?: number; allowFailure?: boolean; input?: string } = {},
): Promise<CommandResult> {
  return new Promise((resolvePromise, reject) => {
    let timedOut = false;
    let terminationPromise: Promise<void> | undefined;
    let terminationConfirmationTimeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: (options.environment ?? createSafeChildEnvironment(process.env)) as NodeJS.ProcessEnv,
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stdin.end(options.input);
    const stdoutCapture = createBoundedOutputCapture();
    const stderrCapture = createBoundedOutputCapture();
    child.stdout.on("data", (chunk: Buffer) => { appendBoundedOutput(stdoutCapture, chunk); });
    child.stderr.on("data", (chunk: Buffer) => { appendBoundedOutput(stderrCapture, chunk); });
    const timeout = setTimeout(() => {
      timedOut = true;
      terminationConfirmationTimeout = setTimeout(() => {
        rejectOnce(new Error(`${command} timed out and process-tree termination could not be confirmed.`));
      }, PROCESS_TREE_TERMINATION_TIMEOUT_MS);
      terminationPromise = terminateProcessTree(child);
      void terminationPromise.catch(rejectOnce);
    }, options.timeoutMilliseconds ?? 30_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      if (terminationConfirmationTimeout) clearTimeout(terminationConfirmationTimeout);
      rejectOnce(error);
    });
    child.once("close", async (code) => {
      clearTimeout(timeout);
      if (terminationConfirmationTimeout) clearTimeout(terminationConfirmationTimeout);
      if (settled) return;
      if (timedOut) {
        try { await terminationPromise; } catch (error) { rejectOnce(error); return; }
        rejectOnce(new Error(`${command} exceeded its bounded execution time and its process tree was terminated.`));
        return;
      }
      const stdout = renderBoundedOutput(stdoutCapture);
      const stderr = renderBoundedOutput(stderrCapture);
      if (stdoutCapture.truncated || stderrCapture.truncated) {
        rejectOnce(new Error(
          `Command exited with code ${code ?? "unknown"} and output exceeded the bounded capture limit: stdout=${stdoutCapture.totalBytes} bytes, stderr=${stderrCapture.totalBytes} bytes. `
          + redactSensitiveDiagnostic(stderr || stdout),
        ));
        return;
      }
      if (code === 0 || options.allowFailure) {
        settled = true;
        resolvePromise({ stdout, stderr });
        return;
      }
      rejectOnce(new Error(`${command} exited with code ${code}: ${redactSensitiveDiagnostic(stderr || stdout)}`));
    });
  });
}

export function trustedDockerExecutableCandidates(platform: NodeJS.Platform) {
  if (platform === "win32") return WINDOWS_DOCKER_EXECUTABLES;
  if (["linux", "darwin"].includes(platform)) return POSIX_DOCKER_EXECUTABLES;
  return Object.freeze([]) as readonly string[];
}

async function inspectTrustedExecutable(path: string): Promise<TrustedExecutableObservation | null> {
  try {
    const stat = await lstat(path);
    return { isFile: stat.isFile(), isSymbolicLink: stat.isSymbolicLink(), canonicalPath: resolve(await realpath(path)) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function resolveTrustedDockerCliEntrypointForPlatform(
  platform: NodeJS.Platform,
  probe: TrustedExecutableProbe,
) {
  const candidates = trustedDockerExecutableCandidates(platform);
  if (candidates.length === 0) throw new Error("This operating system has no approved Docker CLI installation location.");
  for (const candidate of candidates) {
    try {
      const requested = resolve(candidate);
      const observed = await probe(requested);
      if (!observed || !observed.isFile || observed.isSymbolicLink) continue;
      if (resolve(observed.canonicalPath) !== requested) continue;
      // Trust is anchored in the OS-protected, explicitly approved installation
      // location. This does not cryptographically authenticate a locally replaced
      // Docker binary; host ACL and software-installation integrity remain required.
      return requested;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error("A trusted Docker CLI installation could not be resolved.");
}

export async function resolveTrustedDockerCliEntrypoint() {
  return resolveTrustedDockerCliEntrypointForPlatform(process.platform, inspectTrustedExecutable);
}

export function assertTrustedDockerExecutableAgreement(expected: string, observed: string, platform: NodeJS.Platform = process.platform) {
  const candidates = trustedDockerExecutableCandidates(platform).map((candidate) => resolve(candidate));
  if (!candidates.includes(resolve(expected)) || resolve(expected) !== resolve(observed)) {
    throw new Error("The orchestrator and independently resolved Docker executables do not match.");
  }
  return resolve(observed);
}

export function parseArguments(argv: string[]) {
  const mode = argv[0] as Mode | undefined;
  if (!mode || !["prepare", "test", "cleanup"].includes(mode)) throw new Error("Expected prepare, test, or cleanup mode.");
  const stateIndexes = argv.flatMap((value, index) => value === "--state" ? [index] : []);
  if (mode === "prepare" && argv.length !== 1) throw new Error("Prepare mode does not accept a state path or additional arguments.");
  if (mode !== "prepare" && (stateIndexes.length !== 1 || argv.length !== 3)) throw new Error("Exactly one explicit --state path is required.");
  const stateIndex = stateIndexes[0] ?? -1;
  const statePath = stateIndex >= 0 ? argv[stateIndex + 1] : undefined;
  if (mode !== "prepare" && (!statePath || !isStrictlyWithin(tmpdir(), statePath))) {
    throw new Error("An explicit state file beneath the operating-system temporary directory is required.");
  }
  return { mode, statePath: statePath ? resolve(statePath) : undefined };
}

function requireBootstrapEnvironment() {
  const approval = process.env.ECDLINK_ALLOW_DISPOSABLE_DB_TESTS ?? "";
  const postgresImage = process.env.ECDLINK_INTEGRATION_POSTGRES_IMAGE ?? "";
  const confirmedMajor = Number(process.env.ECDLINK_CONFIRMED_PRODUCTION_POSTGRES_MAJOR);
  if (approval !== DISPOSABLE_DATABASE_APPROVAL) throw new Error("Disposable database mutation was not explicitly approved.");
  return { approval, postgresImage, confirmedMajor };
}

function createPostgresUrl(password: string, hostPort: number, databaseName: string) {
  return `postgresql://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(password)}@127.0.0.1:${hostPort}/${databaseName}?connection_limit=6&pool_timeout=10`;
}

async function inspectContainer(dockerExecutable: string, containerNameOrId: string): Promise<ObservedContainerIdentity> {
  const result = await runCommand(dockerExecutable, ["inspect", containerNameOrId], { timeoutMilliseconds: 15_000 });
  return parseDockerInspection(result.stdout);
}

async function waitForHealthyContainer(dockerExecutable: string, containerId: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = await runCommand(dockerExecutable, ["inspect", "--format", "{{.State.Health.Status}}", containerId], { allowFailure: true, timeoutMilliseconds: 5_000 });
    if (status.stdout.trim() === "healthy") return;
    if (status.stdout.trim() === "unhealthy") throw new Error("The disposable PostgreSQL container became unhealthy.");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("The disposable PostgreSQL container did not become healthy within the bounded startup window.");
}

function sentinelSql(runId: string, nonce: string) {
  return [
    'CREATE TABLE IF NOT EXISTS public."EcdlinkIntegrationIdentity" ("purpose" TEXT PRIMARY KEY, "runId" TEXT NOT NULL, "nonce" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());',
    `INSERT INTO public."EcdlinkIntegrationIdentity" ("purpose", "runId", "nonce") VALUES ('${DISPOSABLE_DATABASE_PURPOSE}', '${runId}', '${nonce}');`,
  ].join(" ");
}

export function psqlArguments(containerId: string, databaseName: string, tabular = false) {
  return [
    "exec", containerId, "psql", "--username", POSTGRES_USER, "--dbname", databaseName,
    "--set", "ON_ERROR_STOP=1",
    ...(tabular ? ["--tuples-only", "--no-align", "--field-separator", "|"] : []),
    "--file=-",
  ];
}

export type PostgresServerVersionAttestation = Readonly<{
  serverVersionNum: number;
  major: number;
}>;

export function parseExactPsqlRow(output: unknown, expectedFieldCount: number): string[] {
  if (typeof output !== "string" || !Number.isSafeInteger(expectedFieldCount) || expectedFieldCount < 1) {
    throw new Error("The PostgreSQL identity attestation output is missing, malformed, or ambiguous.");
  }
  const match = /^([^\r\n]+)(?:\r?\n)?$/.exec(output);
  if (!match) throw new Error("The PostgreSQL identity attestation output is missing, malformed, or ambiguous.");
  const fields = match[1].split("|");
  if (fields.length !== expectedFieldCount) {
    throw new Error("The PostgreSQL identity attestation output is missing, malformed, or ambiguous.");
  }
  return fields;
}

export function attestPostgresServerMajor(
  serverVersionNum: unknown,
  expectedMajor: number,
): PostgresServerVersionAttestation {
  if (!Number.isSafeInteger(expectedMajor) || expectedMajor < 10) {
    throw new Error("The expected PostgreSQL server major is invalid.");
  }
  if (typeof serverVersionNum !== "string" || !/^[1-9]\d{5,}$/.test(serverVersionNum)) {
    throw new Error("The PostgreSQL server version attestation is missing or malformed.");
  }
  const parsedVersionNum = Number(serverVersionNum);
  if (!Number.isSafeInteger(parsedVersionNum)) {
    throw new Error("The PostgreSQL server version attestation is missing or malformed.");
  }
  const major = Math.floor(parsedVersionNum / 10_000);
  if (major !== expectedMajor) {
    throw new Error("The running PostgreSQL server major does not match the approved disposable database major.");
  }
  return { serverVersionNum: parsedVersionNum, major };
}

async function bootstrapSentinel(dockerExecutable: string, containerId: string, databaseName: string, runId: string, nonce: string) {
  await runCommand(dockerExecutable, psqlArguments(containerId, databaseName), {
    timeoutMilliseconds: 15_000,
    input: sentinelSql(runId, nonce),
  });
}

async function readPreSentinelDatabaseIdentity(
  dockerExecutable: string,
  containerId: string,
  databaseName: string,
  expectedPostgresMajor: number,
): Promise<ObservedPreSentinelDatabaseIdentity> {
  const result = await runCommand(dockerExecutable, psqlArguments(containerId, databaseName, true), {
    timeoutMilliseconds: 15_000,
    input: "SELECT current_database(), current_user, COALESCE(inet_server_addr()::text, '127.0.0.1'), inet_server_port(), current_setting('server_version_num');",
  });
  const [observedDatabaseName, databaseUser, serverAddress, serverPort, serverVersionNum] = parseExactPsqlRow(result.stdout, 5);
  attestPostgresServerMajor(serverVersionNum, expectedPostgresMajor);
  return { databaseName: observedDatabaseName, databaseUser, serverAddress, serverPort: Number(serverPort) };
}

async function readDatabaseIdentity(
  dockerExecutable: string,
  containerId: string,
  databaseName: string,
  expectedPostgresMajor?: number,
): Promise<ObservedDatabaseIdentity> {
  const versionSelection = expectedPostgresMajor === undefined ? "" : ", current_setting('server_version_num')";
  const sql = `SELECT current_database(), current_user, COALESCE(inet_server_addr()::text, '127.0.0.1'), inet_server_port(), "purpose", "runId", "nonce"${versionSelection} FROM public."EcdlinkIntegrationIdentity";`;
  const result = await runCommand(dockerExecutable, psqlArguments(containerId, databaseName, true), {
    timeoutMilliseconds: 15_000,
    input: sql,
  });
  const fields = parseExactPsqlRow(result.stdout, expectedPostgresMajor === undefined ? 7 : 8);
  const [observedDatabaseName, databaseUser, serverAddress, serverPort, purpose, runId, nonce, serverVersionNum] = fields;
  if (expectedPostgresMajor !== undefined) attestPostgresServerMajor(serverVersionNum, expectedPostgresMajor);
  return { databaseName: observedDatabaseName, databaseUser, serverAddress, serverPort: Number(serverPort), purpose, runId, nonce };
}

type WindowsAclTarget = "directory" | "file";

export async function secureWindowsHarnessPath(
  path: string,
  target: WindowsAclTarget,
  dependencies: {
    platform?: NodeJS.Platform;
    architecture?: string;
    probe?: TrustedExecutableProbe;
    execute?: typeof runCommand;
    sid?: string;
  } = {},
) {
  const platform = dependencies.platform ?? process.platform;
  if (platform !== "win32") return;
  const executable = await resolveTrustedIcaclsExecutableForPlatform(
    platform,
    dependencies.architecture ?? process.arch,
    dependencies.probe ?? inspectTrustedExecutable,
  );
  const execute = dependencies.execute ?? runCommand;
  const sid = dependencies.sid
    ? validateWindowsSid(dependencies.sid)
    : await resolveCurrentWindowsProcessSid(
      platform,
      dependencies.architecture ?? process.arch,
      dependencies.probe ?? inspectTrustedExecutable,
      execute,
    );
  const permission = target === "directory" ? `*${sid}:(OI)(CI)(F)` : `*${sid}:(R,W)`;
  await execute(
    executable,
    [path, "/inheritance:r", "/grant:r", permission],
    { timeoutMilliseconds: 10_000 },
  );
}

async function restrictStateFile(path: string) {
  await chmod(path, 0o600);
  await secureWindowsHarnessPath(path, "file");
}

async function secureHarnessDirectory(path: string) {
  await chmod(path, 0o700);
  await secureWindowsHarnessPath(path, "directory");
}

async function writeState(state: HarnessState) {
  await writeFile(state.statePath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await restrictStateFile(state.statePath);
}

export async function assertNoLinksRecursively(root: string): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error("The disposable working directory contains a symbolic link or junction.");
    if (stat.isDirectory()) await assertNoLinksRecursively(path);
    else if (!stat.isFile()) throw new Error("The disposable working directory contains an unexpected filesystem object.");
  }
}

async function loadState(path: string) {
  const canonical = await verifyCanonicalOwnedStatePath(path, dirname(path), tmpdir());
  const state = JSON.parse(await readFile(canonical.statePath, "utf8")) as HarnessState;
  assertStateProof(state.stateProof);
  if (state.statePath !== canonical.statePath || state.temporaryRoot !== canonical.temporaryRoot) throw new Error("The integration state file does not own the requested path.");
  return state;
}

async function verifyState(state: HarnessState, dockerExecutable: string, attestServerMajor = true) {
  const dedicated = assertDedicatedIntegrationEnvironment({
    ECDLINK_ALLOW_DISPOSABLE_DB_TESTS: state.approval,
    INTEGRATION_DATABASE_URL: state.integrationDatabaseUrl,
    INTEGRATION_DIRECT_URL: state.integrationDirectUrl,
  });
  if (dedicated.databaseUrl !== state.integrationDatabaseUrl || dedicated.directUrl !== state.integrationDirectUrl) throw new Error("Dedicated integration database URL validation failed.");
  assertTrustedDockerExecutableAgreement(state.dockerExecutablePath, dockerExecutable);
  const observedContainer = await inspectContainer(dockerExecutable, state.containerId);
  validateObservedContainer(state, observedContainer);
  for (const databaseName of [state.databaseName, state.fullHistoryDatabaseName]) {
    validateObservedDatabase(
      state,
      await readDatabaseIdentity(
        dockerExecutable,
        state.containerId,
        databaseName,
        attestServerMajor ? state.confirmedProductionPostgresMajor : undefined,
      ),
      databaseName,
    );
  }
  return observedContainer;
}

async function prepare() {
  const dockerExecutable = await resolveTrustedDockerCliEntrypoint();
  const bootstrap = requireBootstrapEnvironment();
  const runId = randomUUID().replaceAll("-", "");
  const nonce = randomBytes(32).toString("hex");
  const stateProof = randomBytes(32).toString("hex");
  const password = randomBytes(32).toString("base64url");
  const containerName = `ecdlink-export-it-${runId}`;
  const databaseName = `ecdlink_export_it_${runId}`;
  const fullHistoryDatabaseName = `ecdlink_export_full_it_${runId}`;
  const temporaryRoot = join(resolve(await realpath(tmpdir())), containerName);
  const envPath = join(temporaryRoot, "postgres.env");
  const statePath = join(temporaryRoot, STATE_FILENAME);
  const basePlan = {
    approval: bootstrap.approval,
    runId,
    nonce,
    databaseName,
    fullHistoryDatabaseName,
    containerName,
    postgresImage: bootstrap.postgresImage,
    confirmedProductionPostgresMajor: bootstrap.confirmedMajor,
    temporaryRoot,
    operatingSystemTemporaryRoot: tmpdir(),
  };
  validateDisposableDatabasePlan(basePlan);
  let containerId: string | undefined;
  let temporaryRootCreated = false;
  try {
    await mkdir(temporaryRoot, { recursive: false, mode: 0o700 });
    temporaryRootCreated = true;
    await secureHarnessDirectory(temporaryRoot);
    await writeFile(envPath, `POSTGRES_USER=${POSTGRES_USER}\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=${databaseName}\n`, { flag: "wx", mode: 0o600 });
    await restrictStateFile(envPath);
    const started = await runCommand(dockerExecutable, [
      "run", "--detach", "--name", containerName,
      "--label", `${DISPOSABLE_CONTAINER_PURPOSE_LABEL}=${DISPOSABLE_DATABASE_PURPOSE}`,
      "--label", `${DISPOSABLE_CONTAINER_RUN_LABEL}=${runId}`,
      "--env-file", envPath,
      "--publish", "127.0.0.1::5432",
      "--health-cmd", `pg_isready --username ${POSTGRES_USER} --dbname ${databaseName}`,
      "--health-interval", "1s", "--health-timeout", "3s", "--health-retries", "30",
      bootstrap.postgresImage,
    ], { timeoutMilliseconds: 60_000 });
    containerId = started.stdout.trim();
    await waitForHealthyContainer(dockerExecutable, containerId);
    const observed = await inspectContainer(dockerExecutable, containerId);
    const primaryUrl = createPostgresUrl(password, observed.hostPort, databaseName);
    const state: HarnessState = {
      ...basePlan,
      integrationDatabaseUrl: primaryUrl,
      integrationDirectUrl: primaryUrl,
      expectedHost: "127.0.0.1",
      expectedPort: observed.hostPort,
      containerId,
      dockerExecutablePath: dockerExecutable,
      postgresUser: POSTGRES_USER,
      postgresPassword: password,
      statePath,
      createdAt: new Date().toISOString(),
      stateProof,
    };
    validateObservedContainer(state, observed);
    validatePreSentinelDatabaseIdentity(state, await readPreSentinelDatabaseIdentity(dockerExecutable, containerId, databaseName, state.confirmedProductionPostgresMajor));
    await bootstrapSentinel(dockerExecutable, containerId, databaseName, runId, nonce);
    validateObservedDatabase(state, await readDatabaseIdentity(dockerExecutable, containerId, databaseName, state.confirmedProductionPostgresMajor));

    await runCommand(dockerExecutable, ["exec", containerId, "createdb", "--username", POSTGRES_USER, fullHistoryDatabaseName], { timeoutMilliseconds: 15_000 });
    validatePreSentinelDatabaseIdentity(state, await readPreSentinelDatabaseIdentity(dockerExecutable, containerId, fullHistoryDatabaseName, state.confirmedProductionPostgresMajor), fullHistoryDatabaseName);
    await bootstrapSentinel(dockerExecutable, containerId, fullHistoryDatabaseName, runId, nonce);
    validateObservedDatabase(state, await readDatabaseIdentity(dockerExecutable, containerId, fullHistoryDatabaseName, state.confirmedProductionPostgresMajor), fullHistoryDatabaseName);
    await writeState(state);
    process.stdout.write(`Disposable integration environment prepared. State file: ${statePath}\n`);
  } catch (error) {
    process.stderr.write(`${redactSensitiveDiagnostic(error)}\n`);
    process.stderr.write(containerId
      ? `Container ${containerId.slice(0, 12)} was not removed automatically; verify its identity manually before cleanup.\n`
      : "No Docker container identity was returned.\n");
    const failures: unknown[] = [error];
    if (temporaryRootCreated) {
      try {
        await assertNoLinksRecursively(temporaryRoot);
        await rm(temporaryRoot, { recursive: true, force: false });
      } catch (cleanupError) {
        failures.push(cleanupError);
      }
    }
    if (failures.length > 1) throw new AggregateError(failures, "Disposable harness preparation failed and temporary credential cleanup was incomplete.");
    throw error;
  }
}

async function copyMigrationStage(target: string, through?: string) {
  const sourceRoot = join(process.cwd(), "prisma");
  const targetRoot = join(target, "prisma");
  await mkdir(join(targetRoot, "migrations"), { recursive: true });
  await copyFile(join(sourceRoot, "schema.prisma"), join(targetRoot, "schema.prisma"));
  await copyFile(join(sourceRoot, "migrations", "migration_lock.toml"), join(targetRoot, "migrations", "migration_lock.toml"));
  const entries = (await readdir(join(sourceRoot, "migrations"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && (!through || entry.name <= through))
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const source = join(sourceRoot, "migrations", entry.name);
    const destination = join(targetRoot, "migrations", entry.name);
    await cp(source, destination, { recursive: true, errorOnExist: true });
    const sourceBytes = await readFile(join(source, "migration.sql"));
    const destinationBytes = await readFile(join(destination, "migration.sql"));
    if (hashMigrationBytes(sourceBytes) !== hashMigrationBytes(destinationBytes)) throw new Error(`Migration checksum changed while staging ${entry.name}.`);
  }
  return join(targetRoot, "schema.prisma");
}

export function disposableChildEnvironment(state: HarnessState, databaseName: string, extras: Record<string, string | undefined> = {}) {
  const databaseUrl = replaceDatabaseName(state.integrationDatabaseUrl, databaseName);
  return createDisposableChildEnvironment(process.env, {
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    INTEGRATION_DATABASE_URL: databaseUrl,
    INTEGRATION_DIRECT_URL: databaseUrl,
    ECDLINK_ALLOW_DISPOSABLE_DB_TESTS: DISPOSABLE_DATABASE_APPROVAL,
    ECDLINK_INTEGRATION_RUN_ID: state.runId,
    ECDLINK_INTEGRATION_NONCE: state.nonce,
    ECDLINK_INTEGRATION_DATABASE_NAME: databaseName,
    ECDLINK_INTEGRATION_CONTAINER_ID: state.containerId,
    ECDLINK_INTEGRATION_STATE_PATH: state.statePath,
    ECDLINK_INTEGRATION_STATE_PROOF: state.stateProof,
  }, extras);
}

export async function resolveTrustedCliEntrypoint(relativePath: string) {
  const dependencyRoot = resolve(process.cwd(), "node_modules");
  const requested = resolve(dependencyRoot, relativePath);
  const relativePathFromDependencies = relative(dependencyRoot, requested);
  if (!relativePathFromDependencies || relativePathFromDependencies.startsWith("..") || isAbsolute(relativePathFromDependencies)) {
    throw new Error("The requested CLI entrypoint is outside the installed dependency directory.");
  }
  const stat = await lstat(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("The requested CLI entrypoint is not a trusted regular file.");
  const canonical = resolve(await realpath(requested));
  if (canonical !== requested) throw new Error("The requested CLI entrypoint failed canonical path verification.");
  return canonical;
}

export async function validateIsolatedPrismaDirectory(schemaPath: string) {
  const workingDirectory = dirname(resolve(schemaPath));
  const repositoryRoot = resolve(process.cwd());
  const relation = relative(repositoryRoot, workingDirectory);
  if (!relation.startsWith("..") || isAbsolute(relation)) throw new Error("Prisma migration execution must run outside the repository tree.");
  for (const filename of [".env", ".env.local"]) {
    try {
      await lstat(join(workingDirectory, filename));
      throw new Error("The isolated Prisma directory contains a prohibited environment file.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return workingDirectory;
}

async function deployMigrations(schemaPath: string, state: HarnessState, databaseName: string) {
  const prismaCli = await resolveTrustedCliEntrypoint(join("prisma", "build", "index.js"));
  const workingDirectory = await validateIsolatedPrismaDirectory(schemaPath);
  await runCommand(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], {
    cwd: workingDirectory,
    environment: disposableChildEnvironment(state, databaseName),
    timeoutMilliseconds: 120_000,
  });
}

async function runIntegrationTests(state: HarnessState, databaseName: string, files: string[], stage: string) {
  const tsxCli = await resolveTrustedCliEntrypoint(join("tsx", "dist", "cli.mjs"));
  await runCommand(process.execPath, [tsxCli, "--conditions=react-server", "--test", "--test-concurrency=1", ...files], {
    environment: disposableChildEnvironment(state, databaseName, { ECDLINK_INTEGRATION_MIGRATION_STAGE: stage }),
    timeoutMilliseconds: 180_000,
  });
}

async function executeTests(statePath: string) {
  const dockerExecutable = await resolveTrustedDockerCliEntrypoint();
  const state = await loadState(statePath);
  await verifyState(state, dockerExecutable);
  const stagingRoot = join(state.temporaryRoot, "migration-staging");
  await mkdir(stagingRoot, { recursive: false });
  const stageA = join(stagingRoot, "stage-a");
  const stageB = join(stagingRoot, "stage-b");
  const stageC = join(stagingRoot, "stage-c");
  const migrationTest = "lib/grant-report-export/integration/migration.integration.test.ts";
  const integrationFiles = [
    migrationTest,
    "lib/grant-report-export/integration/artifact-lifecycle.integration.test.ts",
    "lib/grant-report-export/integration/outbox.integration.test.ts",
    "lib/grant-report-export/integration/concurrency.integration.test.ts",
  ];

  const stageASchema = await copyMigrationStage(stageA, C2B1_MIGRATION);
  await deployMigrations(stageASchema, state, state.databaseName);
  await runIntegrationTests(state, state.databaseName, [migrationTest], "A");

  await cp(stageA, stageB, { recursive: true, errorOnExist: true });
  const outboxSource = join(process.cwd(), "prisma", "migrations", OUTBOX_MIGRATION);
  const outboxDestination = join(stageB, "prisma", "migrations", OUTBOX_MIGRATION);
  await cp(outboxSource, outboxDestination, { recursive: true, errorOnExist: true });
  if (hashMigrationBytes(await readFile(join(outboxSource, "migration.sql"))) !== hashMigrationBytes(await readFile(join(outboxDestination, "migration.sql")))) {
    throw new Error("The staged outbox migration checksum does not match the committed migration.");
  }
  await deployMigrations(join(stageB, "prisma", "schema.prisma"), state, state.databaseName);
  await runIntegrationTests(state, state.databaseName, integrationFiles, "B");

  const stageCSchema = await copyMigrationStage(stageC);
  await deployMigrations(stageCSchema, state, state.fullHistoryDatabaseName);
  await runIntegrationTests(state, state.fullHistoryDatabaseName, [migrationTest], "C");
  process.stdout.write("Disposable PostgreSQL integration stages completed successfully.\n");
}

async function cleanup(statePath: string) {
  const dockerExecutable = await resolveTrustedDockerCliEntrypoint();
  const state = await loadState(statePath);
  const observed = await verifyState(state, dockerExecutable, false);
  const cleanupTarget = validateCleanupTarget(state, observed);
  await runCommand(dockerExecutable, ["rm", "--force", cleanupTarget.containerId], { timeoutMilliseconds: 30_000 });
  const after = await runCommand(dockerExecutable, ["inspect", cleanupTarget.containerId], { allowFailure: true, timeoutMilliseconds: 5_000 });
  if (!/No such object|No such container/i.test(after.stderr + after.stdout)) throw new Error("The verified disposable Docker container still exists after cleanup.");
  const resolvedTemporaryRoot = resolve(cleanupTarget.temporaryRoot);
  if (!isStrictlyWithin(tmpdir(), resolvedTemporaryRoot) || !resolvedTemporaryRoot.endsWith(state.containerName)) {
    throw new Error("The temporary cleanup target failed final ownership verification.");
  }
  const canonical = await verifyCanonicalOwnedStatePath(state.statePath, resolvedTemporaryRoot, tmpdir());
  if (canonical.temporaryRoot !== resolvedTemporaryRoot) throw new Error("The temporary cleanup target changed during verification.");
  await assertNoLinksRecursively(resolvedTemporaryRoot);
  await rm(resolvedTemporaryRoot, { recursive: true, force: false });
  process.stdout.write("Verified disposable integration environment removed.\n");
}

async function main() {
  const { mode, statePath } = parseArguments(process.argv.slice(2));
  if (mode === "prepare") await prepare();
  if (mode === "test") await executeTests(statePath!);
  if (mode === "cleanup") await cleanup(statePath!);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${redactSensitiveDiagnostic(error)}\n`);
    process.exitCode = 1;
  });
}
