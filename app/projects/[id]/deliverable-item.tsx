import type { Deliverable } from "@/lib/db/schema";
import { describeEstimate } from "@/lib/deliverables/list";
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
  return (
    <li className="flex items-baseline gap-4 border-b border-zinc-100 py-3 dark:border-zinc-900">
      <span
        aria-hidden="true"
        className="w-5 shrink-0 text-right text-sm tabular-nums text-zinc-400 dark:text-zinc-500"
      >
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {deliverable.title}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
          {describeEstimate(deliverable.estimatedMinutes)}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {deliverableStatusLabel(deliverable.status)}
        </p>
      </div>
    </li>
  );
}
