/**
 * The DOM ids a field's parts are wired together with.
 *
 * They are derived from the field's form name rather than generated, so the
 * id is knowable from outside the component: moving focus to the first bad
 * field after a rejected submission only needs the name the error is keyed
 * under, not a handle on the element.
 *
 * Every id is namespaced under the control's own id, which keeps a field's
 * hint and error from colliding with anything else that happens to be called
 * `notes-hint` on the same page.
 */

/** The control itself — what a `<label for>` and `document.getElementById` point at. */
export function fieldId(name: string): string {
  return `field-${name}`;
}

export function fieldHintId(name: string): string {
  return `${fieldId(name)}-hint`;
}

export function fieldErrorId(name: string): string {
  return `${fieldId(name)}-error`;
}
