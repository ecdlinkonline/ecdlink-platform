import "server-only";

import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { Readable } from "node:stream";
import {
  assertGrantReportExportStoragePath,
  buildGrantReportExportStoragePath,
  type ExportStorageOwnership,
  GrantReportExportLifecycleError,
  normalizeExportFailureCode,
  safeGrantReportExportError,
} from "@/lib/grant-report-export/export-lifecycle";
import {
  claimGrantReportExportAttempt,
  claimGrantReportExportCleanup,
  completeGrantReportExportAttempt,
  completeGrantReportExportCleanup,
  failGrantReportExportAttempt,
  releaseGrantReportExportCleanup,
  renewGrantReportExportAttemptLease,
  renewGrantReportExportCleanupLease,
  stageGrantReportExportFile,
  type ClaimedGrantReportExportAttempt,
} from "@/lib/grant-report-export/lifecycle-repository";
import { createGrantReportSubmissionPack, type GrantReportSubmissionPackArtifact } from "@/lib/grant-report-export/pack";
import { getGrantReportVersionExportSource } from "@/lib/grant-report-export/repository";

type Authorization = { error: Response } | { internalUser: { id: string }; [key: string]: unknown };

export type GrantReportExportStorage = {
  uploadAndVerify(input: {
    ownership: ExportStorageOwnership;
    path: string;
    stream: Readable;
    contentType: "application/zip";
    byteSize: number;
    sha256: string;
    createOnly: true;
    signal: AbortSignal;
  }): Promise<{ path: string; byteSize: number; sha256: string; storageObjectVersion?: string | null }>;
  removeOwnedObject(input: { ownership: ExportStorageOwnership; path: string; ignoreMissing: true }): Promise<void>;
};

type LifecycleRepository = {
  claim: typeof claimGrantReportExportAttempt;
  renew: typeof renewGrantReportExportAttemptLease;
  stage: typeof stageGrantReportExportFile;
  complete: typeof completeGrantReportExportAttempt;
  fail: typeof failGrantReportExportAttempt;
  claimCleanup: typeof claimGrantReportExportCleanup;
  renewCleanup: typeof renewGrantReportExportCleanupLease;
  completeCleanup: typeof completeGrantReportExportCleanup;
  releaseCleanup: typeof releaseGrantReportExportCleanup;
};

const defaultRepository: LifecycleRepository = {
  claim: claimGrantReportExportAttempt,
  renew: renewGrantReportExportAttemptLease,
  stage: stageGrantReportExportFile,
  complete: completeGrantReportExportAttempt,
  fail: failGrantReportExportAttempt,
  claimCleanup: claimGrantReportExportCleanup,
  renewCleanup: renewGrantReportExportCleanupLease,
  completeCleanup: completeGrantReportExportCleanup,
  releaseCleanup: releaseGrantReportExportCleanup,
};

type CleanupScheduler = {
  monotonicNow: () => number;
  setInterval: (callback: () => void, milliseconds: number) => ReturnType<typeof setInterval>;
  clearInterval: (handle: ReturnType<typeof setInterval>) => void;
  setTimeout: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
};

const defaultCleanupScheduler: CleanupScheduler = {
  monotonicNow: () => performance.now(),
  setInterval: (callback, milliseconds) => setInterval(callback, milliseconds),
  clearInterval: (handle) => clearInterval(handle),
  setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearTimeout: (handle) => clearTimeout(handle),
};

// This remains below the two-minute database cleanup lease. It bounds local work
// while leaving time for the token-fenced release to make the attempt recoverable.
const defaultCleanupDeadlineMilliseconds = 90_000;

async function authorizeExportGeneration(): Promise<Authorization> {
  const { requireReportAdmin } = await import("@/lib/api/report-auth");
  return requireReportAdmin() as Promise<Authorization>;
}

function createGenerationSignal(source?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(source?.reason);
  source?.addEventListener("abort", abort, { once: true });
  if (source?.aborted) abort();
  return { controller, release: () => source?.removeEventListener("abort", abort) };
}

export async function generateGrantReportExportForAdmin(
  input: { reportId: string; versionId: string; signal?: AbortSignal },
  dependencies: {
    storage: GrantReportExportStorage;
    authorize?: () => Promise<Authorization>;
    repository?: LifecycleRepository;
    load?: typeof getGrantReportVersionExportSource;
    assemble?: typeof createGrantReportSubmissionPack;
    fileAssetId?: () => string;
    heartbeatMilliseconds?: number;
  },
) {
  const authorization = await (dependencies.authorize ?? authorizeExportGeneration)();
  if ("error" in authorization) return authorization;
  const actorUserId = authorization.internalUser.id;
  const repository = dependencies.repository ?? defaultRepository;
  const claim = await repository.claim({ reportId: input.reportId, versionId: input.versionId, actorUserId });
  if (claim.kind !== "claimed") return claim;

  const linkedSignal = createGenerationSignal(input.signal);
  const heartbeatMilliseconds = Math.max(10, dependencies.heartbeatMilliseconds ?? 60_000);
  let heartbeatFailure: unknown;
  let heartbeatPromise: Promise<void> | undefined;
  let heartbeatStopped = false;
  const heartbeat = setInterval(() => {
    if (heartbeatPromise || heartbeatStopped || linkedSignal.controller.signal.aborted) return;
    heartbeatPromise = repository.renew(claim).then(() => undefined).catch((error) => {
      heartbeatFailure = error;
      linkedSignal.controller.abort(error);
    }).finally(() => { heartbeatPromise = undefined; });
  }, heartbeatMilliseconds);
  heartbeat.unref();

  async function stopHeartbeat(throwOnFailure: boolean) {
    if (!heartbeatStopped) {
      heartbeatStopped = true;
      clearInterval(heartbeat);
    }
    await heartbeatPromise;
    if (throwOnFailure && heartbeatFailure) throw heartbeatFailure;
  }

  let pack: GrantReportSubmissionPackArtifact | undefined;
  let failureCode: Parameters<LifecycleRepository["fail"]>[0]["failureCode"] = "PACK_GENERATION_FAILED";
  try {
    const source = await (dependencies.load ?? getGrantReportVersionExportSource)({ reportId: input.reportId, versionId: input.versionId });
    if (!source) throw new GrantReportExportLifecycleError("REPORT_VERSION_NOT_FOUND", "Grant report version not found.");
    pack = await (dependencies.assemble ?? createGrantReportSubmissionPack)(source, { signal: linkedSignal.controller.signal });
    if (heartbeatFailure) throw heartbeatFailure;

    const fileAssetId = dependencies.fileAssetId?.() ?? randomUUID();
    const storageOwnership = {
      reportId: input.reportId,
      versionId: input.versionId,
      artifactId: claim.artifactId,
      attemptNumber: claim.attemptNumber,
      generationToken: claim.generationToken,
      fileAssetId,
    } satisfies ExportStorageOwnership;
    const storageKey = buildGrantReportExportStoragePath(storageOwnership);
    const manifestSchemaVersion = pack.manifest.manifestSchemaVersion;
    await repository.stage({
      ...claim,
      fileAssetId,
      storageKey,
      sha256: pack.sha256,
      byteSize: pack.byteSize,
      manifestSchemaVersion,
      actorUserId,
    });
    failureCode = "STORAGE_UPLOAD_FAILED";
    const stored = await dependencies.storage.uploadAndVerify({
      ownership: storageOwnership,
      path: storageKey,
      stream: pack.stream,
      contentType: "application/zip",
      byteSize: pack.byteSize,
      sha256: pack.sha256,
      createOnly: true,
      signal: linkedSignal.controller.signal,
    });
    if (heartbeatFailure) throw heartbeatFailure;
    if (stored.path !== storageKey || stored.byteSize !== pack.byteSize || stored.sha256 !== pack.sha256) {
      throw new GrantReportExportLifecycleError("STORAGE_VERIFICATION_FAILED", "The stored export failed integrity verification.");
    }
    await stopHeartbeat(true);
    failureCode = "GENERATION_FAILED";
    const completed = await repository.complete({
      ...claim,
      fileAssetId,
      sha256: pack.sha256,
      byteSize: pack.byteSize,
      manifestSchemaVersion,
      storageObjectVersion: stored.storageObjectVersion,
      actorUserId,
    });
    return { kind: "completed" as const, ...completed };
  } catch (error) {
    await stopHeartbeat(false);
    const normalizedFailureCode = normalizeExportFailureCode(heartbeatFailure ?? error);
    try {
      await repository.fail({
        ...claim,
        actorUserId,
        failureCode: normalizedFailureCode === "GENERATION_FAILED" ? failureCode : normalizedFailureCode,
      });
    } catch {
      throw safeGrantReportExportError(undefined, "GENERATION_FAILED");
    }
    throw safeGrantReportExportError(heartbeatFailure ?? error, "GENERATION_FAILED");
  } finally {
    await stopHeartbeat(false);
    linkedSignal.release();
    await pack?.cleanup();
  }
}

export async function cleanupGrantReportExportAttemptForAdmin(
  input: { attemptId: string },
  dependencies: {
    storage: GrantReportExportStorage;
    authorize?: () => Promise<Authorization>;
    repository?: LifecycleRepository;
    heartbeatMilliseconds?: number;
    cleanupDeadlineMilliseconds?: number;
    cleanupScheduler?: CleanupScheduler;
  },
) {
  const authorization = await (dependencies.authorize ?? authorizeExportGeneration)();
  if ("error" in authorization) return authorization;
  const actorUserId = authorization.internalUser.id;
  const repository = dependencies.repository ?? defaultRepository;
  const scheduler = dependencies.cleanupScheduler ?? defaultCleanupScheduler;
  const heartbeatMilliseconds = Math.max(10, dependencies.heartbeatMilliseconds ?? 30_000);
  const cleanupDeadlineMilliseconds = dependencies.cleanupDeadlineMilliseconds ?? defaultCleanupDeadlineMilliseconds;
  if (!Number.isFinite(cleanupDeadlineMilliseconds) || cleanupDeadlineMilliseconds <= heartbeatMilliseconds) {
    throw new GrantReportExportLifecycleError("CLEANUP_FAILED", "The export cleanup deadline is invalid.");
  }
  const claim = await repository.claimCleanup({ attemptId: input.attemptId, actorUserId });
  const cleanupStartedAt = scheduler.monotonicNow();
  let heartbeatFailure: unknown;
  let heartbeatPromise: Promise<void> | undefined;
  let heartbeatStopped = false;
  let controlSettled = false;
  let resolveControl!: (outcome: { kind: "deadline" } | { kind: "heartbeat_failure"; error: unknown }) => void;
  const control = new Promise<{ kind: "deadline" } | { kind: "heartbeat_failure"; error: unknown }>((resolve) => {
    resolveControl = resolve;
  });

  function stopHeartbeatScheduler() {
    if (heartbeatStopped) return;
    heartbeatStopped = true;
    scheduler.clearInterval(heartbeat);
  }

  function settleControl(outcome: { kind: "deadline" } | { kind: "heartbeat_failure"; error: unknown }) {
    if (controlSettled) return;
    controlSettled = true;
    stopHeartbeatScheduler();
    resolveControl(outcome);
  }

  const heartbeat = scheduler.setInterval(() => {
    if (heartbeatPromise || heartbeatStopped) return;
    if (scheduler.monotonicNow() - cleanupStartedAt >= cleanupDeadlineMilliseconds) {
      settleControl({ kind: "deadline" });
      return;
    }
    heartbeatPromise = repository.renewCleanup(claim).then(() => undefined).catch((error) => {
      heartbeatFailure = error;
      settleControl({ kind: "heartbeat_failure", error });
    }).finally(() => { heartbeatPromise = undefined; });
  }, heartbeatMilliseconds);
  heartbeat.unref();

  let deadline: ReturnType<typeof setTimeout>;
  function enforceDeadline() {
    const remaining = cleanupDeadlineMilliseconds - (scheduler.monotonicNow() - cleanupStartedAt);
    if (remaining > 0) {
      deadline = scheduler.setTimeout(enforceDeadline, remaining);
      deadline.unref();
      return;
    }
    settleControl({ kind: "deadline" });
  }
  deadline = scheduler.setTimeout(enforceDeadline, cleanupDeadlineMilliseconds);
  deadline.unref();

  const deadlineError = () => new GrantReportExportLifecycleError(
    "CLEANUP_FAILED",
    "The export cleanup exceeded its safe operation deadline.",
  );

  async function settleHeartbeatBeforeFinalization() {
    stopHeartbeatScheduler();
    const activeHeartbeat = heartbeatPromise;
    if (activeHeartbeat) {
      const outcome = await Promise.race([
        activeHeartbeat.then(() => ({ kind: "heartbeat_settled" as const })),
        control,
      ]);
      if (outcome.kind === "deadline") throw deadlineError();
      if (outcome.kind === "heartbeat_failure") throw outcome.error;
    }
    if (heartbeatFailure) throw heartbeatFailure;
    if (scheduler.monotonicNow() - cleanupStartedAt >= cleanupDeadlineMilliseconds) throw deadlineError();
  }

  try {
    assertGrantReportExportStoragePath(claim.storageKey, {
      reportId: claim.reportId,
      versionId: claim.versionId,
      artifactId: claim.artifactId,
      attemptNumber: claim.attemptNumber,
      generationToken: claim.generationToken,
      fileAssetId: claim.fileAssetId,
    });
    const deletion = dependencies.storage.removeOwnedObject({
      ownership: {
        reportId: claim.reportId,
        versionId: claim.versionId,
        artifactId: claim.artifactId,
        attemptNumber: claim.attemptNumber,
        generationToken: claim.generationToken,
        fileAssetId: claim.fileAssetId,
      },
      path: claim.storageKey,
      ignoreMissing: true,
    }).then(
      () => ({ kind: "deleted" as const }),
      (error: unknown) => ({ kind: "deletion_failed" as const, error }),
    );
    const deletionOutcome = await Promise.race([deletion, control]);
    if (deletionOutcome.kind === "deadline") throw deadlineError();
    if (deletionOutcome.kind === "heartbeat_failure") throw deletionOutcome.error;
    if (deletionOutcome.kind === "deletion_failed") throw deletionOutcome.error;
    await settleHeartbeatBeforeFinalization();
    await repository.completeCleanup({ ...claim, actorUserId });
    return { kind: "cleaned" as const, attemptId: claim.attemptId, fileAssetId: claim.fileAssetId };
  } catch (error) {
    stopHeartbeatScheduler();
    try {
      await repository.releaseCleanup({ ...claim, actorUserId, failureCode: "STORAGE_CLEANUP_FAILED" });
    } catch {
      throw safeGrantReportExportError(undefined, "CLEANUP_FAILED");
    }
    throw safeGrantReportExportError(error, "CLEANUP_FAILED");
  } finally {
    stopHeartbeatScheduler();
    scheduler.clearTimeout(deadline);
  }
}
