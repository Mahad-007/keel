"use client";

import { submitAriaLabel, submitLabel } from "./submit-label";
import { useFormPending } from "./use-form-pending";

/**
 * The button that submits a form, and the only thing on the page that knows
 * the form is in flight.
 *
 * Disabling while pending is not decoration: an impatient second click on a
 * slow save is how a client gets created twice. The label changes with it, so
 * the button says what is happening rather than going grey and silent.
 *
 * It is a separate component from the form for a reason that is easy to get
 * wrong — `useFormPending` reads the nearest `<form>` ancestor, so a hook
 * called inside the form component itself would see nothing.
 *
 * Two looks, because a page can hold two submit buttons and they must not
 * read as equals: `primary` is the thing the page is for, `secondary` is the
 * one sitting next to it that the user should have to mean.
 */
const VARIANTS = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
  secondary:
    "border border-zinc-300 bg-white text-zinc-900 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500",
} as const;

export type SubmitButtonVariant = keyof typeof VARIANTS;

export type SubmitButtonProps = {
  children: string;
  /** What the button says once it has been pressed: "Saving…". */
  pendingLabel: string;
  variant?: SubmitButtonVariant;
  /**
   * What this button acts on, for a button whose meaning comes from the row
   * it sits in. A table of "Restore" buttons reads as one repeated control to
   * anyone who cannot see which line they are on.
   */
  subject?: string;
  /**
   * What the button contributes to the submission, for a form offering
   * several ways out of it — the project status buttons, where "Pause" and
   * "Close" post the same form to the same action and differ only in this.
   *
   * A browser sends the pressed button's name and value and nobody else's,
   * which is what makes this a choice rather than a field: a form submitted
   * without pressing a button carries no status at all, and reads as blank
   * rather than defaulting to whichever move happened to be first.
   */
  name?: string;
  value?: string;
};

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  subject,
  name,
  value,
}: SubmitButtonProps) {
  const pending = useFormPending();
  const label = submitLabel(children, pendingLabel, pending);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      aria-label={submitAriaLabel(label, subject)}
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]}`}
    >
      {label}
    </button>
  );
}
