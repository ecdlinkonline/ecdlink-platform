export type SubmissionGate = { current: boolean };

export function beginSubmission(gate: SubmissionGate) {
  if (gate.current) return false;
  gate.current = true;
  return true;
}

export function endSubmission(gate: SubmissionGate) {
  gate.current = false;
}
