"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that knows whether its form is in flight. Separate from the
 * form component because `useFormStatus` reports on the nearest `<form>`
 * ancestor — a hook called inside the form component itself would see
 * nothing.
 *
 * Disabling while pending is not decoration: an impatient second click on a
 * slow save is how a client gets created twice.
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

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  subject,
}: {
  children: string;
  pendingLabel: string;
  variant?: keyof typeof VARIANTS;
  /**
   * What the button acts on, for a button whose meaning comes from the row it
   * sits in. A table of "Restore" buttons reads as one repeated control to
   * anyone who cannot see which line they are on; naming the subject makes
   * each one "Restore Ada Lovelace" without widening the column.
   */
  subject?: string;
}) {
  const { pending } = useFormStatus();
  const label = pending ? pendingLabel : children;

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-label={subject === undefined ? undefined : `${label} ${subject}`}
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]}`}
    >
      {label}
    </button>
  );
}
