import "server-only";

import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import { buildGrantReportExportSections, type ExportTable } from "@/lib/grant-report-export/adapters";
import { assertExportInputSize, GrantReportExportLimitError, grantReportExportLimits } from "@/lib/grant-report-export/limits";
import type { GrantReportExportData } from "@/lib/grant-report-export/types";

const nodeRequire = createRequire(import.meta.url);
const regularFont = nodeRequire.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const boldFont = nodeRequire.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");
const pageMargin = 42;
const contentBottom = 790;

function safeMetadata(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

function date(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function addDraftWatermark(doc: PDFKit.PDFDocument, draft: boolean) {
  if (!draft) return;
  const cursor = { x: doc.x, y: doc.y };
  doc.save();
  doc.fillColor("#b91c1c").opacity(0.12).font("Bold").fontSize(28);
  doc.rotate(-32, { origin: [doc.page.width / 2, doc.page.height / 2] });
  doc.text("DRAFT \u2014 NOT SUBMITTED", 75, doc.page.height / 2 - 25, { width: doc.page.width - 150, align: "center", lineBreak: false });
  doc.restore();
  doc.opacity(1).fillColor("#0f172a");
  doc.x = cursor.x;
  doc.y = cursor.y;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height <= contentBottom) return;
  doc.addPage();
  doc.y = pageMargin;
}

function heading(doc: PDFKit.PDFDocument, value: string) {
  ensureSpace(doc, 34);
  doc.moveDown(0.4).font("Bold").fontSize(15).fillColor("#172554").text(value, { paragraphGap: 7 });
  doc.moveTo(pageMargin, doc.y).lineTo(doc.page.width - pageMargin, doc.y).strokeColor("#cbd5e1").stroke();
  doc.moveDown(0.5).fillColor("#0f172a");
}

function paragraph(doc: PDFKit.PDFDocument, value: string) {
  ensureSpace(doc, 28);
  doc.font("Regular").fontSize(9.5).fillColor("#334155").text(value, { lineGap: 2, paragraphGap: 7 });
}

function table(doc: PDFKit.PDFDocument, value: ExportTable, checkDeadline: () => void) {
  if (!value.rows.length) return;
  const totalWidth = doc.page.width - pageMargin * 2;
  const widths = value.widths.map((width) => width * totalWidth);
  const padding = 5;
  const drawRow = (cells: string[], header: boolean) => {
    checkDeadline();
    doc.font(header ? "Bold" : "Regular").fontSize(header ? 8 : 7.8);
    const rowHeight = Math.max(...cells.map((cell, index) => doc.heightOfString(cell, { width: widths[index] - padding * 2 }))) + padding * 2;
    if (doc.y + rowHeight > contentBottom) {
      doc.addPage();
      doc.y = pageMargin;
      if (!header) drawRow(value.headers, true);
    }
    const top = doc.y;
    let left = pageMargin;
    cells.forEach((cell, index) => {
      doc.rect(left, top, widths[index], rowHeight).fillAndStroke(header ? "#dbeafe" : "#ffffff", "#cbd5e1");
      doc.fillColor("#0f172a").text(cell, left + padding, top + padding, { width: widths[index] - padding * 2, height: rowHeight - padding * 2 });
      left += widths[index];
    });
    doc.x = pageMargin;
    doc.y = top + rowHeight;
  };
  drawRow(value.headers, true);
  value.rows.forEach((row) => drawRow(row, false));
  doc.moveDown(0.5);
}

function renderContent(doc: PDFKit.PDFDocument, data: GrantReportExportData, checkDeadline: () => void) {
  doc.font("Bold").fontSize(23).fillColor("#172554").text("ECDLink Grant Report", { align: "center" });
  doc.moveDown(0.35).fontSize(16).text(data.report.title, { align: "center" });
  doc.moveDown(0.5).font("Regular").fontSize(10).fillColor("#475569");
  doc.text(`Version ${data.report.versionNumber} | ${data.report.versionStatus}`, { align: "center" });
  doc.text(`${date(data.report.reportingPeriodStart)} - ${date(data.report.reportingPeriodEnd)}`, { align: "center" });
  doc.moveDown(1.2);

  heading(doc, "Report identity");
  table(doc, {
    headers: ["Field", "Recorded value"],
    widths: [0.34, 0.66],
    rows: [
      ["Award", data.identity.awardNumber ?? "Historical snapshot unavailable"],
      ["Centre", data.identity.centreName ?? "Historical snapshot unavailable"],
      ["Project", data.identity.projectTitle ?? "Historical snapshot unavailable"],
      ["Lead organisation", data.identity.leadOrganisation ?? "Historical snapshot unavailable"],
      ["Financial year / quarter", [data.report.financialYear, data.report.quarter ? `Q${data.report.quarter}` : null].filter(Boolean).join(" / ") || "Not recorded"],
      ["Due date", date(data.report.dueAt)],
      ["Submitted", data.report.submittedAt ? `${date(data.report.submittedAt)}${data.report.submittedBy ? ` by ${data.report.submittedBy}` : ""}` : "Not submitted"],
    ],
  }, checkDeadline);

  for (const section of buildGrantReportExportSections(data)) {
    checkDeadline();
    heading(doc, section.title);
    section.paragraphs?.forEach((value) => paragraph(doc, value));
    if (section.table) table(doc, section.table, checkDeadline);
  }
}

function decoratePages(doc: PDFKit.PDFDocument, draft: boolean) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    addDraftWatermark(doc, draft);
    doc.font("Regular").fontSize(7.5).fillColor("#64748b");
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.text(`ECDLink | Version-scoped export | Page ${index - range.start + 1} of ${range.count}`, pageMargin, doc.page.height - 28, {
      width: doc.page.width - pageMargin * 2,
      align: "center",
      lineBreak: false,
    });
    doc.page.margins.bottom = bottomMargin;
  }
}

export async function renderGrantReportPdf(
  data: GrantReportExportData,
  options: { now?: Date; maximumBytes?: number; maximumMilliseconds?: number } = {},
) {
  assertExportInputSize(data);
  const startedAt = Date.now();
  const maximumMilliseconds = options.maximumMilliseconds ?? grantReportExportLimits.generationMilliseconds;
  const checkDeadline = () => {
    if (Date.now() - startedAt > maximumMilliseconds) {
      throw new GrantReportExportLimitError("generationMilliseconds", "PDF generation exceeded the safe time limit.");
    }
  };
  const createdAt = options.now ?? new Date();
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: pageMargin, left: pageMargin, right: pageMargin, bottom: 46 },
    bufferPages: true,
    info: {
      Title: safeMetadata(`ECDLink - ${data.report.title} - Version ${data.report.versionNumber}`),
      Author: "ECDLink",
      Subject: safeMetadata(`${data.report.reportType} grant report`),
      Keywords: "ECDLink, grant report, version-scoped export",
      CreationDate: createdAt,
      ModDate: createdAt,
    },
  });
  doc.registerFont("Regular", regularFont);
  doc.registerFont("Bold", boldFont);
  const draft = data.report.versionStatus === "DRAFT";

  const maximumBytes = options.maximumBytes ?? grantReportExportLimits.generatedPdfBytes;
  const chunks: Buffer[] = [];
  let bytes = 0;
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maximumBytes) {
        reject(new GrantReportExportLimitError("generatedPdfBytes", "The generated PDF exceeds the safe size limit."));
        doc.destroy();
        return;
      }
      chunks.push(chunk);
    });
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  try {
    renderContent(doc, data, checkDeadline);
    checkDeadline();
    decoratePages(doc, draft);
    doc.end();
  } catch (error) {
    doc.destroy();
    throw error;
  }
  return output;
}
