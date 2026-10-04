import { AlertNote } from "@/components/form";

/**
 * Why the scope list is not showing what was just pressed.
 *
 * It only appears for a press the server refused, which is the one case where
 * an optimistic list is confusing rather than quick: the line visibly moved, and
 * then it visibly moved back. Without a sentence that is a page that undid the
 * reader's work for no stated reason — the single worst thing a tool that
 * rearranges things in front of you can do.
 *
 * Drawn in the same box as a rejected form's summary, because it is the same
 * kind of message: nothing was written, here is what stopped it.
 */
export function ScopeProblem({ problem }: { problem: string | null }) {
  if (problem === null) return null;

  return <AlertNote className="mt-4">{problem}</AlertNote>;
}
