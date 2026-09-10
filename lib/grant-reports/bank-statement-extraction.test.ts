import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BankStatementExtractionError,
  BankStatementExtractor,
  OcrRequiredBankStatementExtractionProvider,
  PdfTextBankStatementExtractionProvider,
  extractFnbTransactionsFromTextPages,
  extractTransactionsFromTextPages,
  parseBankDate,
  parseBankMoney,
  parseBankTransactionLine,
} from "./bank-statement-extraction";

const fnbFixture = [
  "Statement Period : 4 March 2026 to 4 April 2026",
  "Transactions in RAND (ZAR)",
  "Date Description Amount Balance Accrued Bank Charges",
  "06 Mar POS Purchase Merchant Reference 10,014.50 57,034.56Cr 3.68",
  "25 Mar FNB App Rtc Pmt To Recipient A Salary 1,892.00 55,142.56Cr 8.00",
  "25 Mar FNB App Rtc Pmt To Recipient B Salary 1,892.00 53,250.56Cr 8.00",
  "25 Mar FNB App Rtc Pmt To Recipient C Salary 1,892.00 51,350.56Cr 8.00",
  "25 Mar FNB App Rtc Pmt To Recipient D Salary 1,135.00 50,223.56Cr 8.00",
  "25 Mar FNB App Rtc Pmt To Recipient E Salary 3,178.00 48,072.56Cr 15.00",
  "04 Apr #Monthly Account Fee 93.00 47,979.56Cr",
  "04 Apr #Service Fees 34.68 47,944.88Cr",
  "04 Apr #Cash Deposit Fee 23.60 47,921.28Cr",
  "Closing Balance 47,921.28Cr",
  "No. Credit Transactions 0",
  "No. Debit Transactions 8",
  "0.00Cr",
  "21,127.78Dr",
  "68,303.86Cr",
  "47,921.28Cr",
  "Opening Balance",
  "Closing Balance",
].join("\n");

const fnbMayFixture = [
  "Statement Balances Bank Charges",
  "Statement Period : 4 April 2026 to 4 May 2026",
  "Transactions in RAND (ZAR)",
  "Date Description Amount Balance",
  "Accrued",
  "Bank",
  "Charges",
  "16 Apr r 145.00 47,896.28Cr",
  "23 Apr POS Purchase Merchant A 485442*3609 21 Apr 7,303.89 40,592.39Cr 3.68",
  "24 Apr POS Purchase Merchant B 485442*3609 22 Apr 2,170.84 38,421.55Cr 3.68",
  "25 Apr ADT Cash Deposit Reference 250.00Cr 38,671.55Cr 9.08",
  "04 May r 93.00 38,578.55Cr",
  "04 May r 25.86 37,552.69Cr",
  "04 May r 9.08 37,543.61Cr",
  "Closing Balance 37,543.61Cr",
  "No. Credit Transactions 1",
  "No. Debit Transactions 6",
  "250.00 Cr",
  "10,627.67 Dr",
  "47,921.28 Cr",
  "37,543.61 Cr",
  "Opening Balance",
  "Closing Balance",
].join("\n");

const fnbJuneFixture = [
  "Statement Period : 4 May 2026 to 4 June 2026",
  "Statement Balances",
  "Opening Balance 37,543.61 Cr",
  "Closing Balance 5,968.44 Cr",
  "Transactions in RAND (ZAR)",
  "Date Description Amount Balance",
  "Accrued",
  "Bank",
  "Charges",
  "13 May FNB App Rtc Pmt To Recipient A Salary 3,178.00 34,365.61 Cr 15.00",
  "19 May FNB App Prepaid Airtime 0781517472 180.00 34,185.61 Cr 2.50",
  "19 May FNB App Rtc Pmt To Recipient B Salary 4,435.20 29,750.41 Cr 15.00",
  "19 May FNB App Rtc Pmt To Recipient C Salary 1,584.00 28,166.41 Cr 8.00",
  "19 May FNB App Rtc Pmt To Recipient D Salary 2,640.00 25,526.41 Cr 8.00",
  "19 May FNB App Rtc Pmt To Recipient E Salary 2,640.00 22,886.41 Cr 8.00",
  "19 May FNB App Payment To Recipient F 2,640.00 20,246.41 Cr",
  "21 May POS Purchase Merchant C 485442*3609 19 May 2,156.96 18,089.45 Cr 3.68",
  "21 May POS Purchase Merchant D 485442*3609 19 May 8,182.14 9,907.31 Cr 3.68",
  "25 May ADT Cash Deposit Reference 250.00 Cr 10,157.31 Cr 9.08",
  "26 May POS Purchase Merchant E 485442*3609 24 May 4,014.25 6,143.06 Cr 3.68",
  "04 Jun Electronic Payments Tiering Notice 0.00 6,143.06 Cr 5.00",
  "04 Jun #Monthly Account Fee 93.00 6,050.06 Cr",
  "04 Jun #Service Fees 72.54 5,977.52 Cr",
  "04 Jun #Cash Deposit Fee 9.08 5,968.44 Cr",
  "Closing Balance 5,968.44Cr",
  "No. Credit Transactions 1 250.00 Cr",
  "No. Debit Transactions 13 31,825.17 Dr",
].join("\n");

test("South African money formats normalize without losing debit or credit markers", () => {
  assert.deepEqual(parseBankMoney("R1,250.00"), { amount: 1250, marker: null });
  assert.deepEqual(parseBankMoney("1 250,00"), { amount: 1250, marker: null });
  assert.deepEqual(parseBankMoney("-250.00"), { amount: -250, marker: null });
  assert.deepEqual(parseBankMoney("250.00 DR"), { amount: 250, marker: "DR" });
  assert.deepEqual(parseBankMoney("250.00 CR"), { amount: 250, marker: "CR" });
  assert.equal(parseBankMoney("not money"), null);
});

test("supported statement dates normalize and incomplete dates require authoritative month context", () => {
  assert.equal(parseBankDate("01/08/2026"), "2026-08-01");
  assert.equal(parseBankDate("01-08-2026"), "2026-08-01");
  assert.equal(parseBankDate("2026-08-01"), "2026-08-01");
  assert.equal(parseBankDate("01 Aug 2026"), "2026-08-01");
  assert.equal(parseBankDate("01 AUG", "2026-08-01"), "2026-08-01");
  assert.equal(parseBankDate("01 AUG"), null);
  assert.equal(parseBankDate("31/02/2026"), null);
});

test("transaction lines expose read-only debit, credit, balance and source positions", () => {
  const debit = parseBankTransactionLine("01/08/2026 Grocery Store 250.00 DR 1,000.00", 2, 4);
  const credit = parseBankTransactionLine("02-08-2026 Department Subsidy 1 250,00 CR 2 250,00", 2, 5);
  assert.deepEqual(debit && { date: debit.transactionDate, debit: debit.debit, credit: debit.credit, balance: debit.balance, page: debit.sourcePage, row: debit.sourceRow }, { date: "2026-08-01", debit: 250, credit: null, balance: 1000, page: 2, row: 4 });
  assert.deepEqual(credit && { date: credit.transactionDate, debit: credit.debit, credit: credit.credit, balance: credit.balance }, { date: "2026-08-02", debit: null, credit: 1250, balance: 2250 });
});

test("headers and malformed or uncertain rows are ignored rather than invented", () => {
  assert.equal(parseBankTransactionLine("Transaction Date Description Debit Credit", 1, 1), null);
  assert.equal(parseBankTransactionLine("31/02/2026 Invalid Date 100.00 DR", 1, 2), null);
  assert.equal(parseBankTransactionLine("01 AUG Missing Year 100.00 DR", 1, 3), null);
  assert.equal(parseBankTransactionLine("01/08/2026 Missing Amount", 1, 4), null);
  assert.equal(parseBankTransactionLine("01/08/2026 Ambiguous Direction 100.00", 1, 5), null);
});

test("normalization orders transactions but preserves duplicate-looking source rows", () => {
  const transactions = extractTransactionsFromTextPages([{ pageNumber: 1, text: [
    "02/08/2026 Fee 10.00 DR 990.00",
    "01/08/2026 Deposit 1,000.00 CR 1,000.00",
    "02/08/2026 Fee 10.00 DR 980.00",
  ].join("\n") }]);
  assert.equal(transactions.length, 3);
  assert.deepEqual(transactions.map((item) => item.transactionDate), ["2026-08-01", "2026-08-02", "2026-08-02"]);
  assert.deepEqual(transactions.slice(1).map((item) => item.sourceRow), [1, 3]);
});

test("FNB text statements resolve yearless dates and preserve every visible transaction row", () => {
  const result = extractFnbTransactionsFromTextPages([{ pageNumber: 1, text: fnbFixture }]);
  assert.equal(result.matched, true);
  assert.equal(result.transactions.length, 9);
  assert.deepEqual(result.transactions.map((item) => item.transactionDate), ["2026-03-06", "2026-03-25", "2026-03-25", "2026-03-25", "2026-03-25", "2026-03-25", "2026-04-04", "2026-04-04", "2026-04-04"]);
  assert.equal(result.transactions.every((item) => item.debit !== null && item.credit === null), true);
  assert.deepEqual(result.statementSummary, { periodStart: "2026-03-04", periodEnd: "2026-04-04", openingBalance: 68303.86, closingBalance: 47921.28, reportedCreditCount: 0, reportedCreditTotal: 0, reportedDebitCount: 8, reportedDebitTotal: 21127.78 });
  assert.match(result.transactions[0].description, /POS Purchase/);
  assert.equal(result.transactions.filter((item) => /FNB App Rtc Pmt/.test(item.description)).length, 5);
  assert.match(result.transactions[6].description, /Monthly Account Fee/);
  assert.match(result.transactions[7].description, /Service Fees/);
  assert.match(result.transactions[8].description, /Cash Deposit Fee/);
});

test("FNB parsing preserves duplicate-looking rows and rejects malformed or direction-ambiguous layouts", () => {
  const duplicate = fnbFixture.replace("25 Mar FNB App Rtc Pmt To Recipient B Salary 1,892.00 53,250.56Cr 8.00", "25 Mar FNB App Rtc Pmt To Recipient A Salary 1,892.00 53,250.56Cr 8.00");
  const result = extractFnbTransactionsFromTextPages([{ pageNumber: 1, text: duplicate }]);
  assert.equal(result.transactions.filter((item) => /Recipient A/.test(item.description)).length, 2);
  const ambiguous = fnbFixture.replace("No. Credit Transactions 0", "No. Credit Transactions 1");
  assert.deepEqual(extractFnbTransactionsFromTextPages([{ pageNumber: 1, text: ambiguous }]).transactions, []);
  const malformed = fnbFixture.replace("04 Apr #Cash Deposit Fee 23.60 47,921.28Cr", "04 Apr #Cash Deposit Fee missing values");
  assert.equal(extractFnbTransactionsFromTextPages([{ pageNumber: 1, text: malformed }]).transactions.length, 8);
  const missingEmbeddedDescription = fnbFixture.replace("04 Apr #Monthly Account Fee 93.00 47,979.56Cr", "04 Apr r 93.00 47,979.56Cr");
  assert.equal(extractFnbTransactionsFromTextPages([{ pageNumber: 1, text: missingEmbeddedDescription }]).transactions[6].description, "Description unavailable in embedded PDF text");
});

test("FNB May layout supports detached summaries and an explicitly marked credit", () => {
  const result = extractFnbTransactionsFromTextPages([{ pageNumber: 1, text: fnbMayFixture }]);
  assert.equal(result.matched, true);
  assert.equal(result.transactions.length, 7);
  assert.equal(result.transactions.filter((item) => item.debit !== null).length, 6);
  assert.equal(result.transactions.filter((item) => item.credit !== null).length, 1);
  assert.equal(result.transactions.filter((item) => item.debit !== null).reduce((sum, item) => sum + item.amount, 0), 9747.67);
  assert.equal(result.transactions.filter((item) => item.credit !== null).reduce((sum, item) => sum + item.amount, 0), 250);
  assert.deepEqual(result.statementSummary, { periodStart: "2026-04-04", periodEnd: "2026-05-04", openingBalance: 47921.28, closingBalance: 37543.61, reportedCreditCount: 1, reportedCreditTotal: 250, reportedDebitCount: 6, reportedDebitTotal: 10627.67 });
  assert.match(result.transactions[1].rawText, /21 Apr/);
});

test("FNB June layout supports inline summaries and excludes a zero-value informational row", () => {
  const result = extractFnbTransactionsFromTextPages([{ pageNumber: 1, text: fnbJuneFixture }]);
  assert.equal(result.matched, true);
  assert.equal(result.transactions.length, 14);
  assert.equal(result.transactions.filter((item) => item.debit !== null).length, 13);
  assert.equal(result.transactions.filter((item) => item.credit !== null).length, 1);
  assert.equal(Math.round(result.transactions.filter((item) => item.debit !== null).reduce((sum, item) => sum + item.amount, 0) * 100) / 100, 31825.17);
  assert.equal(result.transactions.filter((item) => item.credit !== null).reduce((sum, item) => sum + item.amount, 0), 250);
  assert.equal(result.transactions.some((item) => item.amount === 0), false);
  assert.deepEqual(result.statementSummary, { periodStart: "2026-05-04", periodEnd: "2026-06-04", openingBalance: 37543.61, closingBalance: 5968.44, reportedCreditCount: 1, reportedCreditTotal: 250, reportedDebitCount: 13, reportedDebitTotal: 31825.17 });
  assert.equal(Math.round((37543.61 + 250 - 31825.17) * 100) / 100, 5968.44);
});

test("the Next.js Node runtime keeps pdf-parse external to avoid its bundled Object.defineProperty failure", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /serverExternalPackages:\s*\["pdf-parse"\]/);
});

test("empty and unsupported statement content fail with safe extraction codes", async () => {
  const extractor = new BankStatementExtractor([]);
  await assert.rejects(() => extractor.extract({ content: new Uint8Array(), mimeType: "application/pdf" }), (error: unknown) => error instanceof BankStatementExtractionError && error.safeCode === "empty_statement");
  await assert.rejects(() => extractor.extract({ content: Uint8Array.of(1), mimeType: "text/csv" }), (error: unknown) => error instanceof BankStatementExtractionError && error.safeCode === "unsupported_file_format");
});

test("a textless PDF reports OCR required instead of fake extraction success", async () => {
  const provider = new PdfTextBankStatementExtractionProvider(async () => [{ pageNumber: 1, text: "   " }]);
  const result = await provider.extract({ content: Uint8Array.of(1), mimeType: "application/pdf" });
  assert.equal(result.state, "OCR_REQUIRED");
  assert.deepEqual(result.transactions, []);
});

test("a text PDF with no parseable rows reports no transactions", async () => {
  const provider = new PdfTextBankStatementExtractionProvider(async () => [{ pageNumber: 1, text: "Account statement with sufficient embedded text but no transaction rows" }]);
  const result = await provider.extract({ content: Uint8Array.of(1), mimeType: "application/pdf" });
  assert.equal(result.state, "NO_TRANSACTIONS");
});

test("a malformed PDF returns a safe parser failure without exposing document content", async () => {
  const provider = new PdfTextBankStatementExtractionProvider(async () => { throw new Error("raw private PDF bytes"); });
  await assert.rejects(
    () => provider.extract({ content: Uint8Array.of(1), mimeType: "application/pdf" }),
    (error: unknown) => error instanceof BankStatementExtractionError && error.safeCode === "malformed_pdf" && !error.message.includes("raw private"),
  );
});

test("image statements use the provider boundary and clearly require OCR configuration", async () => {
  const extractor = new BankStatementExtractor([new OcrRequiredBankStatementExtractionProvider()]);
  for (const mimeType of ["image/jpeg", "image/png"]) {
    const result = await extractor.extract({ content: Uint8Array.of(1), mimeType });
    assert.equal(result.state, "OCR_REQUIRED");
  }
});
