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
}: {
  children: string;
  pendingLabel: string;
  variant?: keyof typeof VARIANTS;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
