import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("all approved report editors render the shared evidence workspace", () => {
  for (const file of ["nlc-grant-report-editor.tsx", "dbe-quarterly-expenditure-editor.tsx", "dbe-quarterly-cash-flow-editor.tsx"]) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    assert.match(source, /GrantReportEvidence/);
    assert.match(source, /activeSection === "documents"/);
  }
});

test("evidence workspace is paginated, private and does not use browser confirm prompts", () => {
  const source = readFileSync(new URL("./grant-report-evidence.tsx", import.meta.url), "utf8");
  assert.match(source, /pageSize: "20"/);
  assert.match(source, /WorkflowActionDialog/);
  assert.match(source, /retained private file is not physically deleted/i);
  assert.match(source, /\?preview=1/);
  assert.match(source, /\?download=1/);
  assert.doesNotMatch(source, /window\.(?:confirm|prompt)/);
});

test("submitted evidence remains reviewable without mutation controls", () => {
  const source = readFileSync(new URL("./grant-report-evidence.tsx", import.meta.url), "utf8");
  assert.match(source, /const canMutate = props\.editable && \(data\?\.version\.editable \?\? true\)/);
  assert.match(source, /This report version is read-only/);
  assert.match(source, /canMutate \? <WorkflowActionDialog/);
});
