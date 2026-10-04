/**
 * Why the scope list is not showing what was just pressed.
 *
 * It only appears for a press the server refused, which is the one case where
 * an optimistic list is confusing rather than quick: the line visibly moved, and
 * then it visibly moved back. Without a sentence that is a page that undid the
 * reader's work for no stated reason — the single worst thing a tool that
 * rearranges things in front of you can do.
 *
 * Drawn like a rejected form's summary, because it is the same kind of message:
 * nothing was written, here is what stopped it. `role="alert"`, since by the
 * time it appears the list has already snapped back and nothing else says why.
 */
export function ScopeProblem({ problem }: { problem: string | null }) {
  if (problem === null) return null;

  return (
    <p
      role="alert"
      className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      {problem}
    </p>
  );
}
