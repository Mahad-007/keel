import { formSummary, type FormState } from "@/lib/forms/state";

import { AlertNote } from "./alert-note";

/**
 * One sentence at the top of a rejected form. The per-field messages say what
 * is wrong; this says that nothing was saved, which is the part the user
 * actually needs and the part they cannot see if the bad field is below the
 * fold.
 *
 * The box it sits in is shared with the scope list's refusals — see
 * `AlertNote`, which is also where the reason for `role="alert"` lives.
 */
export function FormSummary<K extends string>({ state }: { state: FormState<K> }) {
  const summary = formSummary(state);
  if (summary === null) return null;

  return <AlertNote>{summary}</AlertNote>;
}
