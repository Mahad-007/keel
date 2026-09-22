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
 */
export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
