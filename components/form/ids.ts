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
 *
 * A page with two forms asking for the same thing needs more than the field
 * name, though — the scope tab renders an add line at the bottom and, while a
 * row is being edited, a second form asking for the same three fields. Two
 * controls with one id is a label that focuses the wrong box and an
 * `aria-describedby` pointing at somebody else's error. So a form that is one
 * of several passes a `scope`, and every id it renders sits under that.
 */

/**
 * The control itself — what a `<label for>` and `document.getElementById` point
 * at.
 *
 * `scope` is optional because most pages hold one form and a prefix on every id
 * would be noise. Where it is given it must be unique on the page: a row id
 * does that, since a scope list cannot hold the same deliverable twice.
 */
export function fieldId(name: string, scope?: string): string {
  return scope === undefined ? `field-${name}` : `field-${scope}-${name}`;
}

export function fieldHintId(name: string, scope?: string): string {
  return `${fieldId(name, scope)}-hint`;
}

export function fieldErrorId(name: string, scope?: string): string {
  return `${fieldId(name, scope)}-error`;
}
