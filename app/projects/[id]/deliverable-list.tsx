import type { Deliverable } from "@/lib/db/schema";
import { describeScopeList } from "@/lib/deliverables/list";

import { ScopeRows } from "./scope-rows";

/**
 * A project's scope, in the order it was agreed.
 *
 * An ordered list rather than a table, and the element is doing real work:
 * the sequence is part of what was agreed, not a sort somebody chose, so it
 * has to survive being read aloud and being copied out of the page. A table
 * would also invite a column per attribute, and a scope line is a sentence
 * with two figures beside it rather than a row of cells.
 *
 * The position shown is the line's place in the list as rendered, counting
 * from one — not `sortOrder`, which starts at zero and is the data layer's
 * business. If a hand-edited row ever left a gap in the stored positions, the
 * numbers on screen would still read 1, 2, 3, which is what the two parties
 * would be talking about.
 *
 * The rows themselves are a client component, because they can be rearranged
 * and the rearranging shows before the server has agreed to it. The sentence
 * above them is not: the count does not change when a line moves or is marked
 * done, so there is nothing for it to be optimistic about.
 */
export function DeliverableList({
  projectId,
  deliverables,
}: {
  projectId: string;
  deliverables: readonly Deliverable[];
}) {
  return (
    <>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {describeScopeList(deliverables.length)}
      </p>
      <ScopeRows projectId={projectId} deliverables={deliverables} />
    </>
  );
}
