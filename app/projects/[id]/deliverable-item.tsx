import type { Deliverable } from "@/lib/db/schema";
import { describeEstimate, isEstimated } from "@/lib/deliverables/list";
import { deliverableStatusLabel } from "@/lib/deliverables/status";

/**
 * One line of a project's scope: what was agreed, and what it was sized at.
 *
 * The number down the left is the deliverable's place in the list, drawn
 * rather than left to the browser's own list marker so that it lines up with
 * the one under it once the list reaches ten. It is hidden from assistive
 * technology, which already announces the position from the `<ol>` — hearing
 * "three" twice is worse than not hearing it at all.
 *
 * The estimate and the status sit together on the right because they are the
 * two things a reader scans a scope list for: how big, and how far along.
 * Words rather than a bar or a coloured dot — "Not estimated" is a fact, and
 * a grey dot is a puzzle.
 */
export function DeliverableItem({
  deliverable,
  position,
}: {
  deliverable: Deliverable;
  /** Its place in the list as rendered, counting from one. */
  position: number;
}) {
  /*
    A missing estimate is set in the colour the rest of the page uses for
    secondary text, so a column of figures reads as figures and the gaps in it
    are visibly gaps. It still says what it is — the colour is the second way
    of telling, never the only one.
  */
  const estimateTone = isEstimated(deliverable.estimatedMinutes)
    ? "text-zinc-900 dark:text-zinc-100"
    : "text-zinc-500 dark:text-zinc-400";

  return (
    <li className="flex items-baseline gap-4 border-b border-zinc-100 py-3 dark:border-zinc-900">
      <span
        aria-hidden="true"
        className="w-5 shrink-0 text-right text-sm tabular-nums text-zinc-400 dark:text-zinc-500"
      >
        {position}
      </span>
      <div className="min-w-0 flex-1">
        {/*
          A title is allowed 120 characters and nothing makes them be words:
          a pasted URL or a run of hyphens would otherwise push the estimate
          off the right of the list and take the alignment with it.
        */}
        <p className="break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {deliverable.title}
        </p>
        {/*
          Most deliverables are a title and nothing else, so the detail is
          rendered only when there is some — an empty paragraph under every
          line would space the list out for the sake of what is not there.
          Line breaks are kept, because a description is often the two or
          three bullets that stopped an argument about what was agreed.
        */}
        {deliverable.description === null ? null : (
          <p className="mt-1 max-w-prose whitespace-pre-line break-words text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {deliverable.description}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm tabular-nums ${estimateTone}`}>
          {describeEstimate(deliverable.estimatedMinutes)}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {deliverableStatusLabel(deliverable.status)}
        </p>
      </div>
    </li>
  );
}
