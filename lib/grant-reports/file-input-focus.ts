export function restoreFileTriggerFocus(trigger: Pick<HTMLElement, "focus"> | null) {
  trigger?.focus({ preventScroll: true });
}
