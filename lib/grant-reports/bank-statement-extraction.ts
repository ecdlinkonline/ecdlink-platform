import "server-only";

import { createHash } from "node:crypto";

export const bankStatementExtractionMimeTypes = ["application/pdf", "image/jpeg", "image/png"] as const;

export type BankStatementExtractionState = "EXTRACTED" | "NO_TRANSACTIONS" | "OCR_REQUIRED";

export type BankStatementExtractedTransaction = {
  transactionDate: string | null;
  description: string;
  debit: number | null;
  credit: number | null;
  amount: number;
  balance: number | null;
  rawText: string;
  sourcePage: number;
  sourceRow: number;
  confidence: number | null;
};

export type BankStatementExtractionResult = {
  state: BankStatementExtractionState;
  providerName: string;
  providerVersion: string;
  transactions: BankStatementExtractedTransaction[];
  statementSummary?: BankStatementSummary;
};

export type BankStatementSummary = {
  periodStart: string | null;
  periodEnd: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  reportedCreditCount: number | null;
  reportedCreditTotal: number | null;
  reportedDebitCount: number | null;
  reportedDebitTotal: number | null;
};

export type BankStatementExtractionInput = {
  content: Uint8Array;
  mimeType: string;
  statementMonth?: string | null;
};

export interface BankStatementExtractionProvider {
  readonly name: string;
  readonly version: string;
  supports(mimeType: string): boolean;
  extract(input: BankStatementExtractionInput): Promise<BankStatementExtractionResult>;
}

export class BankStatementExtractionError extends Error {
  constructor(message: string, public readonly safeCode: string) {
    super(message);
  }
}

type TextPage = { pageNumber: number; text: string };
type PdfTextReader = (content: Uint8Array) => Promise<TextPage[]>;

function normalizeSpaces(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

export function parseBankMoney(value: string): { amount: number; marker: "DR" | "CR" | null } | null {
  const normalized = normalizeSpaces(value).toUpperCase();
  const marker = normalized.endsWith(" DR") || normalized.endsWith("DR") ? "DR" : normalized.endsWith(" CR") || normalized.endsWith("CR") ? "CR" : null;
  let numeric = normalized.replace(/\s*(?:DR|CR)$/, "").replace(/^R\s*/, "").replace(/\s/g, "");
  if (/^-?\d{1,3}(?:\.\d{3})*,\d{2}$/.test(numeric) || /^-?\d+,\d{2}$/.test(numeric)) {
    numeric = numeric.replace(/\./g, "").replace(",", ".");
  } else {
    numeric = numeric.replace(/,/g, "");
  }
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(numeric)) return null;
  const amount = Number(numeric);
  return Number.isFinite(amount) ? { amount, marker } : null;
}

const monthIndex = new Map<string, number>([["JAN", 0], ["FEB", 1], ["MAR", 2], ["APR", 3], ["MAY", 4], ["JUN", 5], ["JUL", 6], ["AUG", 7], ["SEP", 8], ["OCT", 9], ["NOV", 10], ["DEC", 11]]);

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export function parseBankDate(value: string, statementMonth?: string | null): string | null {
  const text = normalizeSpaces(value).toUpperCase();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return isoDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  match = text.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (match) return isoDate(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  match = text.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
  if (match && monthIndex.has(match[2])) return isoDate(Number(match[3]), monthIndex.get(match[2])!, Number(match[1]));
  match = text.match(/^(\d{1,2})\s+([A-Z]{3})$/);
  if (match && statementMonth && /^\d{4}-\d{2}-\d{2}$/.test(statementMonth) && monthIndex.has(match[2])) {
    const statementYear = Number(statementMonth.slice(0, 4));
    const statementMonthIndex = Number(statementMonth.slice(5, 7)) - 1;
    if (monthIndex.get(match[2]) !== statementMonthIndex) return null;
    return isoDate(statementYear, statementMonthIndex, Number(match[1]));
  }
  return null;
}

const datePrefix = /^(\d{4}-\d{2}-\d{2}|\d{2}[\/-]\d{2}[\/-]\d{4}|\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{4})?)\s+/;
const moneyToken = /(?<!\d)(?:R\s*)?-?(?:(?:\d{1,3}(?:[ ,]\d{3})+|\d+)[.,]\d{2})(?:\s*(?:DR|CR))?/gi;

export function parseBankTransactionLine(rawText: string, sourcePage: number, sourceRow: number, statementMonth?: string | null): BankStatementExtractedTransaction | null {
  const line = normalizeSpaces(rawText);
  const dateMatch = line.match(datePrefix);
  if (!dateMatch) return null;
  const transactionDate = parseBankDate(dateMatch[1], statementMonth);
  if (!transactionDate) return null;
  const body = line.slice(dateMatch[0].length);
  const matches = [...body.matchAll(moneyToken)];
  if (matches.length === 0) return null;
  const parsed = matches.flatMap((match) => {
    const money = parseBankMoney(match[0]);
    return money ? [{ match, money }] : [];
  });
  if (parsed.length === 0) return null;
  const description = normalizeSpaces(body.slice(0, parsed[0].match.index));
  if (!description) return null;

  const balanceEntry = parsed.length >= 2 ? parsed[parsed.length - 1].money : null;
  const movementEntries = balanceEntry ? parsed.slice(0, -1) : parsed;
  let debit: number | null = null;
  let credit: number | null = null;
  for (const { money } of movementEntries) {
    if (money.marker === "DR" || money.amount < 0) debit = Math.abs(money.amount);
    else if (money.marker === "CR") credit = Math.abs(money.amount);
    else if (movementEntries.length >= 2) {
      if (debit === null) debit = Math.abs(money.amount);
      else if (credit === null) credit = Math.abs(money.amount);
    }
  }
  if (debit === null && credit === null) return null;
  const amount = debit ?? credit!;
  return {
    transactionDate,
    description,
    debit,
    credit,
    amount,
    balance: balanceEntry ? balanceEntry.amount : null,
    rawText: line.slice(0, 1000),
    sourcePage,
    sourceRow,
    confidence: null,
  };
}

export function extractTransactionsFromTextPages(pages: TextPage[], statementMonth?: string | null) {
  const transactions: BankStatementExtractedTransaction[] = [];
  for (const page of pages) {
    page.text.split(/\r?\n/).forEach((line, index) => {
      const transaction = parseBankTransactionLine(line, page.pageNumber, index + 1, statementMonth);
      if (transaction) transactions.push(transaction);
    });
  }
  return transactions.sort((left, right) => left.transactionDate!.localeCompare(right.transactionDate!) || left.sourcePage - right.sourcePage || left.sourceRow - right.sourceRow);
}

const fullMonthIndex = new Map<string, number>([
  ["JANUARY", 0], ["FEBRUARY", 1], ["MARCH", 2], ["APRIL", 3], ["MAY", 4], ["JUNE", 5],
  ["JULY", 6], ["AUGUST", 7], ["SEPTEMBER", 8], ["OCTOBER", 9], ["NOVEMBER", 10], ["DECEMBER", 11],
]);

function parseFnbStatementPeriod(text: string) {
  const match = text.match(/Statement Period\s*:\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+to\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!match) return null;
  const startMonth = fullMonthIndex.get(match[2].toUpperCase());
  const endMonth = fullMonthIndex.get(match[5].toUpperCase());
  if (startMonth === undefined || endMonth === undefined) return null;
  const periodStart = isoDate(Number(match[3]), startMonth, Number(match[1]));
  const periodEnd = isoDate(Number(match[6]), endMonth, Number(match[4]));
  return periodStart && periodEnd ? { periodStart, periodEnd } : null;
}

function parseDateWithinPeriod(value: string, period: { periodStart: string; periodEnd: string }) {
  const match = normalizeSpaces(value).toUpperCase().match(/^(\d{1,2})\s+([A-Z]{3})$/);
  if (!match || !monthIndex.has(match[2])) return null;
  const candidates = [...new Set([Number(period.periodStart.slice(0, 4)), Number(period.periodEnd.slice(0, 4))])]
    .map((year) => isoDate(year, monthIndex.get(match[2])!, Number(match[1])))
    .filter((date): date is string => Boolean(date && date >= period.periodStart && date <= period.periodEnd));
  return candidates.length === 1 ? candidates[0] : null;
}

function parseFnbSummary(text: string): BankStatementSummary | null {
  const period = parseFnbStatementPeriod(text);
  const inlineOpening = text.match(/Opening Balance\s+(\d{1,3}(?:,\d{3})*\.\d{2}\s*(?:Cr|Dr))/i);
  const inlineClosing = text.match(/Closing Balance\s+(\d{1,3}(?:,\d{3})*\.\d{2}\s*(?:Cr|Dr))/i);
  const detachedBalances = text.match(/(\d{1,3}(?:,\d{3})*\.\d{2}\s*(?:Cr|Dr))\s*\n(\d{1,3}(?:,\d{3})*\.\d{2}\s*(?:Cr|Dr))\s*\nOpening Balance\s*\nClosing Balance/i);
  const creditCountMatch = text.match(/No\. Credit Transactions\s+(\d+)/i);
  const debitCountMatch = text.match(/No\. Debit Transactions\s+(\d+)/i);
  const inlineCreditTotal = text.match(/No\. Credit Transactions\s+\d+[ \t]+((?:R\s*)?\d{1,3}(?:,\d{3})*\.\d{2}\s*Cr)/i);
  const inlineDebitTotal = text.match(/No\. Debit Transactions\s+\d+[ \t]+((?:R\s*)?\d{1,3}(?:,\d{3})*\.\d{2}\s*Dr)/i);
  const turnoverStart = text.search(/No\. Credit Transactions/i);
  const turnoverText = turnoverStart >= 0 ? text.slice(turnoverStart, turnoverStart + 500) : "";
  const turnoverValues = [...turnoverText.matchAll(moneyToken)].flatMap((match) => {
    const money = parseBankMoney(match[0]);
    return money ? [money] : [];
  });
  const creditTotal = parseBankMoney(inlineCreditTotal?.[1] ?? "")?.amount
    ?? turnoverValues.find((value) => value.marker === "CR")?.amount
    ?? null;
  const debitTotal = parseBankMoney(inlineDebitTotal?.[1] ?? "")?.amount
    ?? turnoverValues.find((value) => value.marker === "DR")?.amount
    ?? null;
  if (!period && !inlineOpening && !inlineClosing && !detachedBalances && !creditCountMatch && !debitCountMatch) return null;
  return {
    periodStart: period?.periodStart ?? null,
    periodEnd: period?.periodEnd ?? null,
    openingBalance: parseBankMoney(inlineOpening?.[1] ?? detachedBalances?.[1] ?? "")?.amount ?? null,
    closingBalance: parseBankMoney(inlineClosing?.[1] ?? detachedBalances?.[2] ?? "")?.amount ?? null,
    reportedCreditCount: creditCountMatch ? Number(creditCountMatch[1]) : null,
    reportedCreditTotal: creditTotal,
    reportedDebitCount: debitCountMatch ? Number(debitCountMatch[1]) : null,
    reportedDebitTotal: debitTotal,
  };
}

function isFnbStatement(text: string, summary: BankStatementSummary) {
  return /Transactions in RAND \(ZAR\)/i.test(text)
    && summary?.reportedCreditCount !== null
    && summary?.reportedDebitCount !== null;
}

export function extractFnbTransactionsFromTextPages(pages: TextPage[]) {
  const documentText = pages.map((page) => page.text).join("\n");
  const summary = parseFnbSummary(documentText);
  const period = summary?.periodStart && summary.periodEnd ? { periodStart: summary.periodStart, periodEnd: summary.periodEnd } : null;
  if (!summary || !period || !isFnbStatement(documentText, summary)) return { matched: false, transactions: [], statementSummary: summary ?? undefined };

  const candidates: BankStatementExtractedTransaction[] = [];
  for (const page of pages) {
    const lines = page.text.split(/\r?\n/);
    const headerIndex = lines.findIndex((line) => /Date\s+Description\s+Amount\s+Balance/i.test(line));
    const closingIndex = lines.findIndex((line, index) => index > headerIndex && /Closing Balance/i.test(line));
    if (headerIndex < 0 || closingIndex < 0) continue;
    lines.slice(headerIndex + 1, closingIndex).forEach((rawText, index) => {
      const line = normalizeSpaces(rawText);
      const dateMatch = line.match(/^(\d{1,2}\s+[A-Za-z]{3})\s+/);
      if (!dateMatch) return;
      const transactionDate = parseDateWithinPeriod(dateMatch[1], period);
      if (!transactionDate) return;
      const body = line.slice(dateMatch[0].length);
      const values = [...body.matchAll(moneyToken)].flatMap((match) => {
        const money = parseBankMoney(match[0]);
        return money ? [{ match, money }] : [];
      });
      if (values.length < 2) return;
      const movement = values[0].money;
      if (movement.amount === 0) return;
      const extractedDescription = normalizeSpaces(body.slice(0, values[0].match.index));
      const description = extractedDescription.length > 1
        ? extractedDescription
        : "Description unavailable in embedded PDF text";
      const credit = movement.marker === "CR" ? Math.abs(movement.amount) : null;
      const debit = credit === null ? Math.abs(movement.amount) : null;
      candidates.push({
        transactionDate,
        description,
        debit,
        credit,
        amount: Math.abs(movement.amount),
        balance: values[1].money.amount,
        rawText: line.slice(0, 1000),
        sourcePage: page.pageNumber,
        sourceRow: headerIndex + index + 2,
        confidence: null,
      });
    });
  }
  const explicitCreditCount = candidates.filter((transaction) => transaction.credit !== null).length;
  const transactions = explicitCreditCount === summary.reportedCreditCount ? candidates : [];
  return { matched: true, transactions, statementSummary: summary ?? undefined };
}

async function readPdfText(content: Uint8Array): Promise<TextPage[]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: content.slice() });
  try {
    const result = await parser.getText({ cellSeparator: "  ", pageJoiner: "" });
    return result.pages.map((page) => ({ pageNumber: page.num, text: page.text }));
  } finally {
    await parser.destroy();
  }
}

export class PdfTextBankStatementExtractionProvider implements BankStatementExtractionProvider {
  readonly name = "pdf-text";
  readonly version = "1";

  constructor(private readonly reader: PdfTextReader = readPdfText) {}

  supports(mimeType: string) {
    return mimeType === "application/pdf";
  }

  async extract(input: BankStatementExtractionInput): Promise<BankStatementExtractionResult> {
    let pages: TextPage[];
    try {
      pages = await this.reader(input.content);
    } catch (error) {
      throw new BankStatementExtractionError("The PDF could not be read.", error instanceof Error && error.name === "PasswordException" ? "password_protected_pdf" : "malformed_pdf");
    }
    if (!pages.some((page) => page.text.trim().length >= 10)) {
      return { state: "OCR_REQUIRED", providerName: this.name, providerVersion: this.version, transactions: [] };
    }
    const fnb = extractFnbTransactionsFromTextPages(pages);
    const transactions = fnb.matched ? fnb.transactions : extractTransactionsFromTextPages(pages, input.statementMonth);
    return { state: transactions.length > 0 ? "EXTRACTED" : "NO_TRANSACTIONS", providerName: this.name, providerVersion: this.version, transactions, statementSummary: fnb.statementSummary };
  }
}

export class OcrRequiredBankStatementExtractionProvider implements BankStatementExtractionProvider {
  readonly name = "ocr-unavailable";
  readonly version = "1";
  supports(mimeType: string) { return mimeType === "image/jpeg" || mimeType === "image/png"; }
  async extract(): Promise<BankStatementExtractionResult> {
    return { state: "OCR_REQUIRED", providerName: this.name, providerVersion: this.version, transactions: [] };
  }
}

export class BankStatementExtractor {
  constructor(private readonly providers: BankStatementExtractionProvider[] = [new PdfTextBankStatementExtractionProvider(), new OcrRequiredBankStatementExtractionProvider()]) {}

  async extract(input: BankStatementExtractionInput) {
    if (input.content.byteLength === 0) throw new BankStatementExtractionError("The bank statement is empty.", "empty_statement");
    if (!bankStatementExtractionMimeTypes.includes(input.mimeType as (typeof bankStatementExtractionMimeTypes)[number])) {
      throw new BankStatementExtractionError("This bank statement format is not supported.", "unsupported_file_format");
    }
    const provider = this.providers.find((candidate) => candidate.supports(input.mimeType));
    if (!provider) throw new BankStatementExtractionError("No extraction provider is available for this file.", "provider_unavailable");
    return provider.extract(input);
  }
}

export function bankTransactionFingerprint(statementId: string, transaction: BankStatementExtractedTransaction) {
  return createHash("sha256").update(`${statementId}\u0000${transaction.sourcePage}\u0000${transaction.sourceRow}\u0000${transaction.rawText}`).digest("hex");
}

export const bankStatementExtractor = new BankStatementExtractor();
