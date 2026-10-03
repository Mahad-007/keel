import type { Deliverable } from "@/lib/db/schema";
import { describeScopeList } from "@/lib/deliverables/list";

import { DeliverableItem } from "./deliverable-item";

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
 */
export function DeliverableList({
  deliverables,
}: {
  deliverables: readonly Deliverable[];
}) {
  return (
    <>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {describeScopeList(deliverables.length)}
      </p>
      {/*
        `role="list"` on a list is normally redundant, and here it is not:
        Tailwind's reset takes the bullets off every list, and WebKit drops
        the list semantics along with them. The sequence is the one thing
        this element exists to convey — and the numbers down the left are
        hidden from assistive technology precisely because the list was
        meant to carry it.
      */}
      <ol
        role="list"
        className="mt-3 border-t border-zinc-200 dark:border-zinc-800"
      >
        {deliverables.map((deliverable, index) => (
          <DeliverableItem
            key={deliverable.id}
            deliverable={deliverable}
            position={index + 1}
          />
        ))}
      </ol>
    </>
  );
}
