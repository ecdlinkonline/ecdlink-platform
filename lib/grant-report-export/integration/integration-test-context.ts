import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  assertDedicatedIntegrationEnvironment,
  DISPOSABLE_DATABASE_APPROVAL,
  DISPOSABLE_DATABASE_PURPOSE,
  isDisposableIntegrationExecutionRequested,
  parseDockerInspection,
  replaceDatabaseName,
  validateDisposableDatabaseConnections,
  verifyLiveDockerAttestation,
  withSingleConnectionLimit,
  verifyCanonicalOwnedStatePath,
  type DisposableDatabaseConnectionPlan,
} from "./database-safety";
import {
  assertTrustedDockerExecutableAgreement,
  resolveTrustedDockerCliEntrypoint,
  runCommand,
} from "../../../scripts/grant-report-export-db-integration";

const MAXIMUM_CLIENTS = 6;
const CLIENT_DISCONNECT_TIMEOUT_MS = 5_000;
let openClients = 0;
let fixtureSequence = 0;

export const integrationExecutionEnabled = isDisposableIntegrationExecutionRequested();

export function databaseIntegrationTest(name: string, operation: (context: TestContext) => Promise<void>) {
  return test(name, { skip: integrationExecutionEnabled ? false : "Disposable PostgreSQL execution was not explicitly authorized." }, operation);
}

function requireIntegrationEnvironment() {
  if (!isDisposableIntegrationExecutionRequested()) throw new Error("Disposable PostgreSQL execution was not explicitly authorized.");
  const dedicated = assertDedicatedIntegrationEnvironment(process.env);
  const runId = process.env.ECDLINK_INTEGRATION_RUN_ID ?? "";
  const nonce = process.env.ECDLINK_INTEGRATION_NONCE ?? "";
  const databaseName = process.env.ECDLINK_INTEGRATION_DATABASE_NAME ?? "";
  const containerId = process.env.ECDLINK_INTEGRATION_CONTAINER_ID ?? "";
  const statePath = process.env.ECDLINK_INTEGRATION_STATE_PATH ?? "";
  const stateProof = process.env.ECDLINK_INTEGRATION_STATE_PROOF ?? "";
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.match(nonce, /^[a-f0-9]{64}$/);
  assert.equal(dedicated.target.databaseName, databaseName);
  assert.match(containerId, /^[a-f0-9]{64}$/);
  assert.match(stateProof, /^[a-f0-9]{64}$/);
  assert.ok(statePath, "The orchestrator-owned integration state path is required.");
  assert.equal(process.env.ECDLINK_ALLOW_DISPOSABLE_DB_TESTS, DISPOSABLE_DATABASE_APPROVAL);
  return { ...dedicated, runId, nonce, databaseName, containerId, statePath, stateProof };
}

type RunStateBinding = DisposableDatabaseConnectionPlan & {
  approval: string;
  runId: string;
  nonce: string;
  databaseName: string;
  fullHistoryDatabaseName: string;
  containerId: string;
  dockerExecutablePath: string;
  statePath: string;
  stateProof: string;
  temporaryRoot: string;
  integrationDatabaseUrl: string;
  integrationDirectUrl: string;
};

async function verifyRunStateBinding(environment: ReturnType<typeof requireIntegrationEnvironment>) {
  const canonical = await verifyCanonicalOwnedStatePath(environment.statePath, dirname(environment.statePath), tmpdir());
  const state = JSON.parse(await readFile(canonical.statePath, "utf8")) as RunStateBinding;
  validateDisposableDatabaseConnections(state);
  assert.ok([state.databaseName, state.fullHistoryDatabaseName].includes(environment.databaseName), "The selected database is not owned by this disposable run.");
  assert.equal(state.temporaryRoot, canonical.temporaryRoot);
  assert.deepEqual({
    approval: state.approval,
    runId: state.runId,
    nonce: state.nonce,
    containerId: state.containerId,
    statePath: state.statePath,
    stateProof: state.stateProof,
    integrationDatabaseUrl: replaceDatabaseName(state.integrationDatabaseUrl, environment.databaseName),
    integrationDirectUrl: replaceDatabaseName(state.integrationDirectUrl, environment.databaseName),
  }, {
    approval: DISPOSABLE_DATABASE_APPROVAL,
    runId: environment.runId,
    nonce: environment.nonce,
    containerId: environment.containerId,
    statePath: canonical.statePath,
    stateProof: environment.stateProof,
    integrationDatabaseUrl: environment.databaseUrl,
    integrationDirectUrl: environment.directUrl,
  }, "The disposable integration environment is not bound to its orchestrator-owned run state.");
  return state;
}

async function inspectLiveDockerContainer(dockerExecutable: string, containerId: string) {
  const result = await runCommand(dockerExecutable, ["inspect", containerId], { timeoutMilliseconds: 15_000 });
  return parseDockerInspection(result.stdout);
}

export async function createIntegrationClient() {
  const environment = requireIntegrationEnvironment();
  const state = await verifyRunStateBinding(environment);
  const dockerExecutable = await resolveTrustedDockerCliEntrypoint();
  assertTrustedDockerExecutableAgreement(state.dockerExecutablePath, dockerExecutable);
  await verifyLiveDockerAttestation(state, (containerId) => inspectLiveDockerContainer(dockerExecutable, containerId));
  if (openClients >= MAXIMUM_CLIENTS) throw new Error(`Integration tests may not open more than ${MAXIMUM_CLIENTS} Prisma clients.`);
  openClients += 1;
  const client = new PrismaClient({ datasources: { db: { url: withSingleConnectionLimit(environment.databaseUrl) } }, log: ["error"] });
  let disconnected = false;
  let disconnectOperation: Promise<void> | undefined;
  const disconnect = async () => {
    if (disconnected) return;
    if (!disconnectOperation) {
      disconnectOperation = client.$disconnect().then(() => {
        disconnected = true;
        openClients -= 1;
      });
    }
    await bounded(disconnectOperation, CLIENT_DISCONNECT_TIMEOUT_MS);
  };
  try {
    await client.$connect();
    await verifyIntegrationDatabaseIdentity(client, environment);
    return { client, disconnect };
  } catch (error) {
    try {
      await disconnect();
    } catch (disconnectError) {
      throw new AggregateError([error, disconnectError], "Integration client verification failed and its disconnect did not complete safely.");
    }
    throw error;
  }
}

async function verifyIntegrationDatabaseIdentity(client: PrismaClient, environment = requireIntegrationEnvironment()) {
  const rows = await client.$queryRaw<Array<{
    databaseName: string;
    databaseUser: string;
    purpose: string;
    runId: string;
    nonce: string;
  }>>(Prisma.sql`
    SELECT
      current_database() AS "databaseName",
      current_user AS "databaseUser",
      "purpose",
      "runId",
      "nonce"
    FROM public."EcdlinkIntegrationIdentity"
  `);
  assert.equal(rows.length, 1, "The disposable database sentinel must contain exactly one row.");
  assert.deepEqual(rows[0], {
    databaseName: environment.databaseName,
    databaseUser: "ecdlink_it",
    purpose: DISPOSABLE_DATABASE_PURPOSE,
    runId: environment.runId,
    nonce: environment.nonce,
  });
}

export async function withIntegrationClient<T>(operation: (client: PrismaClient) => Promise<T>) {
  const resource = await createIntegrationClient();
  try {
    return await operation(resource.client);
  } finally {
    await resource.disconnect();
  }
}

export function uniqueTestId(name: string) {
  const runId = process.env.ECDLINK_INTEGRATION_RUN_ID ?? "unauthorized";
  fixtureSequence += 1;
  return `${runId}:${name}:${fixtureSequence.toString().padStart(4, "0")}`;
}

export function createBarrier(participants: number) {
  if (!Number.isInteger(participants) || participants < 2 || participants > MAXIMUM_CLIENTS) throw new Error("Invalid integration barrier participant count.");
  let arrivals = 0;
  let release: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  return async () => {
    arrivals += 1;
    if (arrivals === participants) release?.();
    await ready;
  };
}

export async function bounded<T>(operation: Promise<T>, milliseconds = 10_000) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Integration operation exceeded ${milliseconds}ms.`)), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
