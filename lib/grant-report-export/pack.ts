import "server-only";

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { ZipArchive, type ArchiverError } from "archiver";
import { grantReportExportLimits, GrantReportExportLimitError } from "@/lib/grant-report-export/limits";
import { buildGrantReportSubmissionPackManifest, canonicalGrantReportManifestJson, type GrantReportSubmissionPackEvidenceEntry } from "@/lib/grant-report-export/manifest";
import { renderGrantReportPdf } from "@/lib/grant-report-export/pdf";
import type { GrantReportVersionExportSource, GrantReportExportEvidenceSource } from "@/lib/grant-report-export/repository";
import { storage, type KnownPrivateFileReference } from "@/lib/storage/storage-service";
import type { PrivateFileContent } from "@/lib/storage/types";
import { defaultDocumentPolicy, validateStorageFile } from "@/lib/storage/validation";

export type GrantReportSubmissionPackFailureCode =
  | "invalid_evidence_metadata"
  | "evidence_unavailable"
  | "evidence_checksum_mismatch"
  | "duplicate_archive_path"
  | "generation_timeout"
  | "generation_aborted"
  | "zip_generation_failed";

export class GrantReportSubmissionPackError extends Error {
  constructor(public readonly code: GrantReportSubmissionPackFailureCode, message: string) {
    super(message);
    this.name = "GrantReportSubmissionPackError";
  }
}

export type GrantReportSubmissionPackArtifact = {
  stream: Readable;
  byteSize: number;
  manifest: ReturnType<typeof buildGrantReportSubmissionPackManifest>;
  cleanup(): Promise<void>;
};

type PackOptions = {
  now?: Date;
  signal?: AbortSignal;
  temporaryRoot?: string;
  maximumMilliseconds?: number;
  maximumZipBytes?: number;
  maximumAggregateEvidenceBytes?: number;
  maximumTemporaryDiskBytes?: number;
  downloadConcurrency?: number;
  streamStartMilliseconds?: number;
  streamLifetimeMilliseconds?: number;
};

type PackDependencies = {
  renderPdf?: typeof renderGrantReportPdf;
  readPrivateFile?: (file: KnownPrivateFileReference) => Promise<PrivateFileContent>;
};

type PreparedEvidence = {
  archivePath: string;
  temporaryPath: string;
  manifest: GrantReportSubmissionPackEvidenceEntry;
};

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function sanitizeArchiveSegment(value: string, fallback: string) {
  const sanitized = value
    .normalize("NFKC")
    .replace(/^[a-zA-Z]:/, "")
    .replace(/[\\/\u0000-\u001f\u007f-\u009f]/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 120);
  return sanitized && sanitized !== "." && sanitized !== ".." ? sanitized : fallback;
}

function archivePathForEvidence(documentType: string, filename: string, sequence: number) {
  const folder = sanitizeArchiveSegment(documentType.toLowerCase().replaceAll("_", "-"), "other");
  const safeFilename = sanitizeArchiveSegment(filename, "evidence-file");
  return `evidence/${folder}/${String(sequence).padStart(3, "0")}-${safeFilename}`;
}

function validateArchivePath(path: string, usedPaths: Set<string>) {
  if (path.includes("\0") || path.includes("\\") || path.startsWith("/") || /^[a-zA-Z]:/.test(path) || path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new GrantReportSubmissionPackError("invalid_evidence_metadata", "An evidence archive path is unsafe.");
  }
  if (usedPaths.has(path)) throw new GrantReportSubmissionPackError("duplicate_archive_path", "The submission pack contains a duplicate archive path.");
  usedPaths.add(path);
}

function ensureMatchingEvidence(source: GrantReportVersionExportSource) {
  if (source.data.evidence.length > grantReportExportLimits.evidenceItems) {
    throw new GrantReportExportLimitError("evidenceItems", "The report version contains too many evidence documents to export safely.");
  }
  if (source.data.evidence.length !== source.evidenceFiles.length) {
    throw new GrantReportSubmissionPackError("invalid_evidence_metadata", "Evidence metadata is incomplete for this report version.");
  }
  const files = new Map(source.evidenceFiles.map((file) => [file.documentId, file]));
  return source.data.evidence.map((document, index) => {
    const file = files.get(document.id);
    if (!file || file.storageProvider !== "supabase" || !document.checksum || !file.checksum) {
      throw new GrantReportSubmissionPackError("invalid_evidence_metadata", "Evidence metadata is incomplete for this report version.");
    }
    if (
      document.originalFilename !== file.originalFilename
      || document.mimeType !== file.mimeType
      || document.fileSize !== file.fileSize
      || document.checksum.toLowerCase() !== file.checksum.toLowerCase()
    ) {
      throw new GrantReportSubmissionPackError("invalid_evidence_metadata", "Evidence metadata does not match its retained private file.");
    }
    if (!Number.isSafeInteger(file.fileSize) || file.fileSize <= 0 || file.fileSize > defaultDocumentPolicy.maxBytes) {
      throw new GrantReportExportLimitError("aggregateEvidenceBytes", "An evidence file exceeds the authoritative file-size policy.");
    }
    return { document, file, archivePath: archivePathForEvidence(document.documentType, document.originalFilename, index + 1) };
  });
}

function guarded<T>(operation: Promise<T>, deadline: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(new GrantReportSubmissionPackError("generation_aborted", "Submission pack generation was aborted."));
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new GrantReportSubmissionPackError("generation_timeout", "Submission pack generation exceeded the safe time limit."));
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new GrantReportSubmissionPackError("generation_aborted", "Submission pack generation was aborted."));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new GrantReportSubmissionPackError("generation_timeout", "Submission pack generation exceeded the safe time limit."));
    }, remaining);
    signal?.addEventListener("abort", onAbort, { once: true });
    operation.then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
}

async function prepareEvidence(
  source: GrantReportVersionExportSource,
  directory: string,
  readPrivateFile: NonNullable<PackDependencies["readPrivateFile"]>,
  deadline: number,
  signal: AbortSignal | undefined,
  concurrency: number,
  maximumAggregateBytes: number,
) {
  const records = ensureMatchingEvidence(source);
  const declaredAggregate = records.reduce((total, record) => total + record.file.fileSize, 0);
  if (declaredAggregate > maximumAggregateBytes) {
    throw new GrantReportExportLimitError("aggregateEvidenceBytes", "The evidence set exceeds the aggregate export limit.");
  }
  const usedPaths = new Set(["report/ECDLink-Report.pdf", "manifest.json"]);
  records.forEach((record) => validateArchivePath(record.archivePath, usedPaths));
  const prepared: PreparedEvidence[] = new Array(records.length);
  let cursor = 0;
  let actualAggregate = 0;
  const workers = Array.from({ length: Math.min(concurrency, records.length) }, async () => {
    while (cursor < records.length) {
      const index = cursor;
      cursor += 1;
      const { document, file, archivePath } = records[index];
      let downloaded: PrivateFileContent;
      try {
        downloaded = await guarded(readPrivateFile(file), deadline, signal);
      } catch (error) {
        if (error instanceof GrantReportSubmissionPackError || error instanceof GrantReportExportLimitError) throw error;
        throw new GrantReportSubmissionPackError("evidence_unavailable", "A required evidence file could not be read from private storage.");
      }
      if (downloaded.originalFilename !== file.originalFilename || downloaded.mimeType !== file.mimeType || downloaded.fileSize !== file.fileSize) {
        throw new GrantReportSubmissionPackError("invalid_evidence_metadata", "Downloaded evidence metadata does not match the report version.");
      }
      const content = Uint8Array.from(downloaded.content);
      try {
        await validateStorageFile({
          name: archivePath.split("/").at(-1) ?? "evidence-file",
          type: file.mimeType,
          size: file.fileSize,
          arrayBuffer: async () => content.buffer,
        }, defaultDocumentPolicy);
      } catch {
        throw new GrantReportSubmissionPackError("invalid_evidence_metadata", "A required evidence file failed its file-type validation.");
      }
      const actualChecksum = sha256(content);
      if (actualChecksum !== file.checksum?.toLowerCase()) {
        throw new GrantReportSubmissionPackError("evidence_checksum_mismatch", "A required evidence file failed its integrity check.");
      }
      actualAggregate += content.byteLength;
      if (actualAggregate > maximumAggregateBytes) {
        throw new GrantReportExportLimitError("aggregateEvidenceBytes", "The evidence set exceeds the aggregate export limit.");
      }
      const temporaryPath = join(directory, `evidence-${String(index + 1).padStart(3, "0")}.bin`);
      await guarded(writeFile(temporaryPath, content, { flag: "wx" }), deadline, signal);
      prepared[index] = {
        archivePath,
        temporaryPath,
        manifest: {
          documentId: document.id,
          archivePath,
          documentType: document.documentType,
          originalFilename: document.originalFilename,
          mimeType: document.mimeType,
          sizeBytes: content.byteLength,
          sha256: actualChecksum,
        },
      };
    }
  });
  const results = await Promise.allSettled(workers);
  const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failed) throw failed.reason;
  return { prepared, aggregateBytes: actualAggregate };
}

async function writeArchive(
  zipPath: string,
  pdfPath: string,
  manifestPath: string,
  evidence: PreparedEvidence[],
  maximumBytes: number,
  deadline: number,
  signal?: AbortSignal,
) {
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const output = createWriteStream(zipPath, { flags: "wx" });
  let written = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      written += chunk.byteLength;
      if (written > maximumBytes) {
        callback(new GrantReportExportLimitError("generatedZipBytes", "The generated ZIP exceeds the safe size limit."));
        return;
      }
      callback(null, chunk);
    },
  });
  archive.on("warning", (error: ArchiverError) => archive.emit("error", error));
  limiter.on("error", (error) => {
    archive.abort();
    output.destroy(error);
  });
  archive.pipe(limiter).pipe(output);
  archive.file(pdfPath, { name: "report/ECDLink-Report.pdf" });
  evidence.forEach((item) => archive.file(item.temporaryPath, { name: item.archivePath }));
  archive.file(manifestPath, { name: "manifest.json" });
  try {
    const archiveCompletion = finished(archive);
    const outputCompletion = finished(output);
    await guarded(Promise.all([archive.finalize(), archiveCompletion, outputCompletion]), deadline, signal);
  } catch (error) {
    archive.abort();
    output.destroy();
    if (error instanceof GrantReportSubmissionPackError || error instanceof GrantReportExportLimitError) throw error;
    throw new GrantReportSubmissionPackError("zip_generation_failed", "The submission pack ZIP could not be generated.");
  }
  return written;
}

export async function createGrantReportSubmissionPack(
  source: GrantReportVersionExportSource,
  options: PackOptions = {},
  dependencies: PackDependencies = {},
): Promise<GrantReportSubmissionPackArtifact> {
  const maximumMilliseconds = options.maximumMilliseconds ?? grantReportExportLimits.packGenerationMilliseconds;
  const deadline = Date.now() + maximumMilliseconds;
  const maximumZipBytes = options.maximumZipBytes ?? grantReportExportLimits.generatedZipBytes;
  const maximumEvidenceBytes = options.maximumAggregateEvidenceBytes ?? grantReportExportLimits.aggregateEvidenceBytes;
  const maximumTemporaryDiskBytes = options.maximumTemporaryDiskBytes ?? grantReportExportLimits.temporaryDiskBytes;
  const concurrency = Math.max(1, Math.min(3, options.downloadConcurrency ?? 3));
  const directory = await mkdtemp(join(options.temporaryRoot ?? tmpdir(), "ecdlink-submission-pack-"));
  let retained = false;
  try {
    const pdf = await guarded((dependencies.renderPdf ?? renderGrantReportPdf)(source.data), deadline, options.signal);
    if (pdf.byteLength > grantReportExportLimits.generatedPdfBytes) {
      throw new GrantReportExportLimitError("generatedPdfBytes", "The generated PDF exceeds the safe size limit.");
    }
    const pdfPath = join(directory, "report.pdf");
    await guarded(writeFile(pdfPath, pdf, { flag: "wx" }), deadline, options.signal);
    const { prepared, aggregateBytes } = await prepareEvidence(
      source,
      directory,
      dependencies.readPrivateFile ?? storage.readKnownPrivateFileForProcessing,
      deadline,
      options.signal,
      concurrency,
      maximumEvidenceBytes,
    );
    const generatedAt = options.now ?? new Date();
    const manifest = buildGrantReportSubmissionPackManifest(source.data, pdf, prepared.map((item) => item.manifest), generatedAt);
    const manifestBytes = Buffer.from(`${canonicalGrantReportManifestJson(manifest)}\n`, "utf8");
    const sourceBytes = pdf.byteLength + aggregateBytes + manifestBytes.byteLength;
    if (sourceBytes + maximumZipBytes > maximumTemporaryDiskBytes) {
      throw new GrantReportExportLimitError("temporaryDiskBytes", "Submission pack generation exceeds the temporary disk limit.");
    }
    const manifestPath = join(directory, "manifest.json");
    await guarded(writeFile(manifestPath, manifestBytes, { flag: "wx" }), deadline, options.signal);
    const zipPath = join(directory, "submission-pack.zip");
    await writeArchive(zipPath, pdfPath, manifestPath, prepared, maximumZipBytes, deadline, options.signal);
    const zipStats = await stat(zipPath);
    const stream = createReadStream(zipPath);
    const streamStartMilliseconds = options.streamStartMilliseconds ?? grantReportExportLimits.streamStartMilliseconds;
    const streamLifetimeMilliseconds = options.streamLifetimeMilliseconds ?? grantReportExportLimits.streamLifetimeMilliseconds;
    let startTimer: NodeJS.Timeout | undefined;
    let lifetimeTimer: NodeJS.Timeout | undefined;
    let cleanupPromise: Promise<void> | undefined;
    const clearLifecycle = () => {
      if (startTimer) clearTimeout(startTimer);
      if (lifetimeTimer) clearTimeout(lifetimeTimer);
      options.signal?.removeEventListener("abort", onAbort);
      stream.removeListener("resume", onResume);
    };
    const cleanup = () => cleanupPromise ??= (async () => {
      clearLifecycle();
      if (!stream.destroyed) stream.destroy();
      if (!stream.closed) await new Promise<void>((resolve) => stream.once("close", resolve));
      await rm(directory, { recursive: true, force: true });
    })();
    const onResume = () => {
      if (startTimer) clearTimeout(startTimer);
      lifetimeTimer = setTimeout(() => { void cleanup(); }, streamLifetimeMilliseconds);
      lifetimeTimer.unref();
    };
    const onAbort = () => {
      if (!stream.destroyed) stream.destroy(new GrantReportSubmissionPackError("generation_aborted", "Submission pack delivery was aborted."));
      void cleanup();
    };
    startTimer = setTimeout(() => { void cleanup(); }, streamStartMilliseconds);
    startTimer.unref();
    stream.once("resume", onResume);
    stream.once("close", () => { void cleanup(); });
    stream.once("error", () => { void cleanup(); });
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    retained = true;
    return { stream, byteSize: zipStats.size, manifest, cleanup };
  } finally {
    if (!retained) await rm(directory, { recursive: true, force: true });
  }
}
