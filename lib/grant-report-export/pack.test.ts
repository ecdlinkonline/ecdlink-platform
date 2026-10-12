import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import yauzl from "yauzl";
import { buildGrantReportExportFixture } from "@/lib/grant-report-export/fixtures";
import { GrantReportExportLimitError } from "@/lib/grant-report-export/limits";
import { createGrantReportSubmissionPack, GrantReportSubmissionPackError } from "@/lib/grant-report-export/pack";
import type { GrantReportVersionExportSource } from "@/lib/grant-report-export/repository";

const syntheticPdf = Buffer.from("%PDF-1.7\nSynthetic evidence\n", "utf8");
const renderedReport = Buffer.from("%PDF-1.7\nSynthetic report\n", "utf8");

function checksum(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

function sourceFor(files: Array<{ filename: string; content?: Buffer; mimeType?: string; documentType?: string }> = [{ filename: "invoice.pdf" }]) {
  const data = buildGrantReportExportFixture({ status: "SUBMITTED" });
  const contents = new Map<string, Buffer>();
  data.evidence = files.map((file, index) => {
    const content = file.content ?? syntheticPdf;
    const id = `document-${index + 1}`;
    contents.set(id, content);
    return {
      id,
      documentType: file.documentType ?? "INVOICE",
      title: `Evidence ${index + 1}`,
      description: null,
      originalFilename: file.filename,
      mimeType: file.mimeType ?? "application/pdf",
      fileSize: content.byteLength,
      checksum: checksum(content),
      uploadedAt: "2026-11-01T10:00:00.000Z",
      indicator: null,
      financialLine: null,
    };
  });
  const source: GrantReportVersionExportSource = {
    data,
    evidenceFiles: data.evidence.map((document) => ({
      documentId: document.id,
      fileAssetId: `asset-${document.id}`,
      storageProvider: "supabase",
      storageKey: `private/${document.id}`,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      checksum: document.checksum,
    })),
  };
  return { source, contents };
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function readZip(buffer: Buffer) {
  return new Promise<Map<string, Buffer>>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) { reject(error ?? new Error("ZIP could not be opened.")); return; }
      const entries = new Map<string, Buffer>();
      zip.on("error", reject);
      zip.on("end", () => resolve(entries));
      zip.on("entry", (entry) => {
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) { reject(streamError ?? new Error("ZIP entry could not be read.")); return; }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          stream.on("error", reject);
          stream.on("end", () => { entries.set(entry.fileName, Buffer.concat(chunks)); zip.readEntry(); });
        });
      });
      zip.readEntry();
    });
  });
}

async function waitForEmpty(directory: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if ((await readdir(directory)).length === 0) return;
    await delay(10);
  }
  assert.deepEqual(await readdir(directory), []);
}

function dependencies(contents: Map<string, Buffer>, counters = { reads: 0, writes: 0 }) {
  return {
    renderPdf: async () => renderedReport,
    readPrivateFile: async (file: { storageKey: string; originalFilename: string; mimeType: string; fileSize: number }) => {
      counters.reads += 1;
      const content = contents.get(file.storageKey.replace("private/", ""));
      if (!content) throw new Error("not found");
      return { content, originalFilename: file.originalFilename, mimeType: file.mimeType, fileSize: file.fileSize };
    },
  };
}

test("submission pack contains the PDF, evidence bytes and matching canonical manifest", async () => {
  const { source, contents } = sourceFor();
  const counters = { reads: 0, writes: 0 };
  const artifact = await createGrantReportSubmissionPack(source, { now: new Date("2027-01-05T12:00:00.000Z") }, dependencies(contents, counters));
  const archiveBytes = await streamToBuffer(artifact.stream);
  const zip = await readZip(archiveBytes);
  await artifact.cleanup();
  assert.equal(artifact.sha256, checksum(archiveBytes));
  assert.deepEqual([...zip.keys()].sort(), ["evidence/invoice/001-invoice.pdf", "manifest.json", "report/ECDLink-Report.pdf"]);
  assert.deepEqual(zip.get("report/ECDLink-Report.pdf"), renderedReport);
  assert.deepEqual(zip.get("evidence/invoice/001-invoice.pdf"), syntheticPdf);
  const manifest = JSON.parse(zip.get("manifest.json")?.toString("utf8") ?? "{}");
  assert.equal(manifest.manifestSchemaVersion, 2);
  assert.equal(manifest.content.report.versionId, "version-fixture");
  assert.equal(manifest.content.report.versionStatus, "SUBMITTED");
  assert.equal(manifest.content.reportPdf.sha256, checksum(renderedReport));
  assert.equal(manifest.content.evidence[0].archivePath, "evidence/invoice/001-invoice.pdf");
  assert.equal(manifest.content.evidence[0].sha256, checksum(syntheticPdf));
  assert.doesNotMatch(JSON.stringify(manifest), /private\/|storageKey|signedUrl|serviceRole/i);
  assert.equal(counters.reads, 1);
  assert.equal(counters.writes, 0);
});

test("duplicate and malicious filenames produce distinct traversal-safe archive paths", async () => {
  const { source, contents } = sourceFor([
    { filename: "..\\..\\C:\\secret.pdf" },
    { filename: "..\\..\\C:\\secret.pdf" },
    { filename: "/absolute/\u0000invoice.pdf" },
  ]);
  const artifact = await createGrantReportSubmissionPack(source, {}, dependencies(contents));
  const zip = await readZip(await streamToBuffer(artifact.stream));
  await artifact.cleanup();
  const evidencePaths = [...zip.keys()].filter((path) => path.startsWith("evidence/"));
  assert.equal(new Set(evidencePaths).size, 3);
  assert.ok(evidencePaths.every((path) => !path.includes("..") && !path.includes("\\") && !path.includes("\0") && !/^[a-zA-Z]:/.test(path)));
  assert.ok(evidencePaths.some((path) => path.startsWith("evidence/invoice/001-")));
  assert.ok(evidencePaths.some((path) => path.startsWith("evidence/invoice/002-")));
});

test("missing evidence fails the whole pack and cleans temporary files", async () => {
  const { source } = sourceFor();
  const root = await mkdtemp(join(tmpdir(), "ecdlink-pack-test-root-"));
  try {
    await assert.rejects(
      () => createGrantReportSubmissionPack(source, { temporaryRoot: root }, { renderPdf: async () => renderedReport, readPrivateFile: async () => { throw new Error("missing"); } }),
      (error: unknown) => error instanceof GrantReportSubmissionPackError && error.code === "evidence_unavailable",
    );
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("MIME, checksum and cross-version metadata mismatches are rejected", async () => {
  const mime = sourceFor();
  mime.source.evidenceFiles[0].mimeType = "image/png";
  await assert.rejects(() => createGrantReportSubmissionPack(mime.source, {}, dependencies(mime.contents)), (error: unknown) => error instanceof GrantReportSubmissionPackError && error.code === "invalid_evidence_metadata");

  const mismatch = sourceFor();
  const alteredPdf = Buffer.from(syntheticPdf);
  alteredPdf[alteredPdf.length - 1] ^= 1;
  mismatch.contents.set("document-1", alteredPdf);
  await assert.rejects(() => createGrantReportSubmissionPack(mismatch.source, {}, dependencies(mismatch.contents)), (error: unknown) => error instanceof GrantReportSubmissionPackError && error.code === "evidence_checksum_mismatch");

  const crossVersion = sourceFor();
  crossVersion.source.evidenceFiles[0].documentId = "document-from-other-version";
  await assert.rejects(() => createGrantReportSubmissionPack(crossVersion.source, {}, dependencies(crossVersion.contents)), (error: unknown) => error instanceof GrantReportSubmissionPackError && error.code === "invalid_evidence_metadata");
});

test("individual, aggregate and final ZIP size limits fail safely", async () => {
  const individual = sourceFor();
  individual.source.data.evidence[0].fileSize = 10_000_001;
  individual.source.evidenceFiles[0].fileSize = 10_000_001;
  await assert.rejects(() => createGrantReportSubmissionPack(individual.source, {}, dependencies(individual.contents)), GrantReportExportLimitError);

  const aggregate = sourceFor();
  await assert.rejects(
    () => createGrantReportSubmissionPack(aggregate.source, { maximumAggregateEvidenceBytes: syntheticPdf.byteLength - 1 }, dependencies(aggregate.contents)),
    (error: unknown) => error instanceof GrantReportExportLimitError && error.limit === "aggregateEvidenceBytes",
  );

  const zip = sourceFor();
  await assert.rejects(
    () => createGrantReportSubmissionPack(zip.source, { maximumZipBytes: 100 }, dependencies(zip.contents)),
    (error: unknown) => error instanceof GrantReportExportLimitError && error.limit === "generatedZipBytes",
  );

  const documentCount = sourceFor(Array.from({ length: 201 }, (_, index) => ({ filename: `evidence-${index}.pdf` })));
  await assert.rejects(
    () => createGrantReportSubmissionPack(documentCount.source, {}, dependencies(documentCount.contents)),
    (error: unknown) => error instanceof GrantReportExportLimitError && error.limit === "evidenceItems",
  );

  const oversizedPdf = sourceFor();
  await assert.rejects(
    () => createGrantReportSubmissionPack(oversizedPdf.source, {}, {
      ...dependencies(oversizedPdf.contents),
      renderPdf: async () => Buffer.alloc(12 * 1024 * 1024 + 1),
    }),
    (error: unknown) => error instanceof GrantReportExportLimitError && error.limit === "generatedPdfBytes",
  );

  const temporaryDisk = sourceFor();
  await assert.rejects(
    () => createGrantReportSubmissionPack(temporaryDisk.source, { maximumTemporaryDiskBytes: 1 }, dependencies(temporaryDisk.contents)),
    (error: unknown) => error instanceof GrantReportExportLimitError && error.limit === "temporaryDiskBytes",
  );
});

test("timeouts and aborts clean every partial temporary artifact", async () => {
  for (const mode of ["timeout", "abort"] as const) {
    const { source, contents } = sourceFor();
    const root = await mkdtemp(join(tmpdir(), `ecdlink-pack-${mode}-`));
    const controller = new AbortController();
    if (mode === "abort") controller.abort();
    try {
      await assert.rejects(
        () => createGrantReportSubmissionPack(source, { temporaryRoot: root, maximumMilliseconds: mode === "timeout" ? -1 : 30_000, signal: controller.signal }, dependencies(contents)),
        (error: unknown) => error instanceof GrantReportSubmissionPackError && error.code === (mode === "timeout" ? "generation_timeout" : "generation_aborted"),
      );
      assert.deepEqual(await readdir(root), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("deadline and abort cancel active private-storage waits before cleanup", async () => {
  for (const mode of ["timeout", "abort"] as const) {
    const { source } = sourceFor();
    const root = await mkdtemp(join(tmpdir(), `ecdlink-pack-active-${mode}-`));
    const controller = new AbortController();
    let started!: () => void;
    const readStarted = new Promise<void>((resolve) => { started = resolve; });
    try {
      const operation = createGrantReportSubmissionPack(source, {
        temporaryRoot: root,
        maximumMilliseconds: mode === "timeout" ? 20 : 30_000,
        signal: controller.signal,
      }, {
        renderPdf: async () => renderedReport,
        readPrivateFile: async () => {
          started();
          return new Promise(() => undefined);
        },
      });
      await readStarted;
      if (mode === "abort") controller.abort();
      await assert.rejects(
        operation,
        (error: unknown) => error instanceof GrantReportSubmissionPackError && error.code === (mode === "timeout" ? "generation_timeout" : "generation_aborted"),
      );
      assert.deepEqual(await readdir(root), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("returned stream retains files while available and cleanup is idempotent", async () => {
  const { source, contents } = sourceFor();
  const root = await mkdtemp(join(tmpdir(), "ecdlink-pack-stream-"));
  try {
    const artifact = await createGrantReportSubmissionPack(source, { temporaryRoot: root }, dependencies(contents));
    assert.equal((await readdir(root)).length, 1);
    const archive = await streamToBuffer(artifact.stream);
    assert.ok(archive.byteLength > 0);
    await waitForEmpty(root);
    await artifact.cleanup();
    await artifact.cleanup();
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an abandoned returned stream expires and a post-generation abort cleans immediately", async () => {
  for (const mode of ["unused", "abort"] as const) {
    const { source, contents } = sourceFor();
    const root = await mkdtemp(join(tmpdir(), `ecdlink-pack-returned-${mode}-`));
    const controller = new AbortController();
    try {
      const artifact = await createGrantReportSubmissionPack(source, {
        temporaryRoot: root,
        signal: controller.signal,
        streamStartMilliseconds: mode === "unused" ? 20 : 60_000,
      }, dependencies(contents));
      assert.equal((await readdir(root)).length, 1);
      if (mode === "abort") controller.abort();
      await waitForEmpty(root);
      assert.equal(artifact.stream.destroyed, true);
      await artifact.cleanup();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("private storage downloads never exceed concurrency three", async () => {
  const { source } = sourceFor(Array.from({ length: 8 }, (_, index) => ({ filename: `evidence-${index}.pdf` })));
  let active = 0;
  let maximum = 0;
  const artifact = await createGrantReportSubmissionPack(source, { downloadConcurrency: 20 }, {
    renderPdf: async () => renderedReport,
    readPrivateFile: async (file) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return { content: syntheticPdf, originalFilename: file.originalFilename, mimeType: file.mimeType, fileSize: file.fileSize };
    },
  });
  await streamToBuffer(artifact.stream);
  await artifact.cleanup();
  assert.equal(maximum, 3);
});
