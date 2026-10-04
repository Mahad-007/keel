import type { ReactNode } from "react";

/**
 * The red box a refused write puts its one sentence in.
 *
 * Shared because the app has two of them and they must not drift: the summary
 * at the top of a rejected form, and the line above a scope list explaining why
 * a press did not stick. Both say the same kind of thing — nothing was written,
 * here is what stopped it — and a reader who has learned what this box means on
 * one page should not have to learn it again on the other.
 *
 * `role="alert"` because it is always rendered in response to something the
 * reader just did, and the thing they just did looked like it had worked. There
 * is no other signal: the form did not navigate, and the list has already
 * snapped back.
 */
export function AlertNote({
  className,
  children,
}: {
  /** Spacing from whatever it sits under, which only the caller knows. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      role="alert"
      className={`rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200 ${className ?? ""}`}
    >
      {children}
    </p>
  );
}
