import { formSummary, type FormState } from "@/lib/forms/state";

/**
 * One sentence at the top of a rejected form. The per-field messages say what
 * is wrong; this says that nothing was saved, which is the part the user
 * actually needs and the part they cannot see if the bad field is below the
 * fold.
 *
 * `role="alert"` so it is announced when it appears — the submission was a
 * client-side transition, and nothing else tells a screen reader the page
 * changed.
 */
export function FormSummary<K extends string>({ state }: { state: FormState<K> }) {
  const summary = formSummary(state);
  if (summary === null) return null;

  return (
    <p
      role="alert"
      className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      {summary}
    </p>
  );
}
