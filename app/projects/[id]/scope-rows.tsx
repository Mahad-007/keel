"use client";

import { useOptimistic, useState } from "react";

import type { Deliverable } from "@/lib/db/schema";
import {
  announceScopeChange,
  applyScopeChange,
  changesScope,
  readScopeChange,
  type ScopeChange,
} from "@/lib/deliverables/arrange";

import { DeliverableControls } from "./deliverable-controls";
import { DeliverableItem } from "./deliverable-item";
import {
  changeDeliverableStatusAction,
  moveDeliverableAction,
} from "./scope-actions";
import { ScopeProblem } from "./scope-problem";

/**
 * The lines of a project's scope, and the controls that rearrange them.
 *
 * A client component, which the rest of this page is not. The reason is the
 * order: a press of Up has to show on screen before the server has agreed to
 * it, and nothing that renders on the server can show a list it has not been
 * sent. So the order lives here, and the server's copy arrives as a prop.
 *
 * One press handler for every control on every line, rather than an action
 * bound per row. Each row submits a form carrying the deliverable it names and
 * what was asked for, which is exactly what a browser puts in a submission —
 * and it leaves this component as the only thing that has to know which server
 * action answers which press.
 */
/**
 * What was last said about a press, and how many presses ago that was.
 *
 * The count is not shown. It is there because a live region only announces
 * text that has changed, and two presses running can say the same thing —
 * marking a line done, reopening it, marking it done again. Keying the sentence
 * on the press makes the second one a new node rather than the same words, which
 * is the difference between being told and not.
 */
type Announcement = { readonly text: string; readonly press: number };

export function ScopeRows({
  projectId,
  deliverables,
}: {
  projectId: string;
  deliverables: readonly Deliverable[];
}) {
  /*
    The list as the reader sees it, which is the server's list plus whatever
    they have just pressed. React keeps the pressed changes until the action
    that was sent for them settles and the re-rendered page arrives, then drops
    them — so a press that the server refuses rolls back on its own, and there
    is no second copy of the order here to get out of step.

    The reducer is the same pure function the tests use, and a move inside it
    goes through the same arithmetic as the write. That is what stops the list
    sliding one way on screen and the other way in the database.
  */
  const [rows, showChange] = useOptimistic<readonly Deliverable[], ScopeChange>(
    deliverables,
    applyScopeChange,
  );

  const [said, setSaid] = useState<Announcement | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  function say(text: string | null) {
    if (text === null) return;
    setSaid((previous) => ({ text, press: (previous?.press ?? 0) + 1 }));
  }

  async function arrange(formData: FormData) {
    const change = readScopeChange(formData);
    /*
      A submission that describes no change it can make: a direction that is not
      one of the two, a form submitted without a button. There is nothing to
      write and nothing to tell the reader — a press that says nothing gets
      nothing done, which is the honest answer.
    */
    /*
      A new press clears the last complaint. Leaving it up would leave a red box
      above a list that has since done what it was told, and the reader would be
      reading it as being about the press they just made.
    */
    setProblem(null);
    if (change === null) return;

    /*
      Said against the list as it reads now, before the change is applied: the
      sentence names where the line ends up, and `announceScopeChange` works
      that out with the same function that moves it.
    */
    say(announceScopeChange(rows, change));

    /*
      A press the list cannot act on: a greyed move control at the end of the
      order, or a line somebody else has deleted since the page was drawn. The
      sentence above has already said so, and there is nothing to write — the
      write would be a round trip whose answer is the list as it already reads.
    */
    if (!changesScope(rows, change)) return;

    // On screen first. A press that waited for the round trip would make
    // rearranging a list feel like it had to be done one keystroke at a time.
    showChange(change);

    const result =
      change.kind === "move"
        ? await moveDeliverableAction(projectId, change.id, change.direction)
        : await changeDeliverableStatusAction(
            projectId,
            change.id,
            change.from,
            change.status,
          );

    /*
      React has already rolled the optimistic change back by now: the action has
      settled, so the list on screen is the server's again. All that is left is
      to say why it snapped back — and to drop the sentence that said the press
      had worked, which it did not.
    */
    if (!result.ok) {
      setSaid(null);
      setProblem(result.problem);
    }
  }

  return (
    <>
      {/*
        The list rearranges itself under the reader with no page load and no
        form submission to notice, so to anyone working from a screen reader a
        press is silent. This is where it is said out loud. Hidden visually,
        because on screen the line visibly moved and a sentence repeating it
        would be clutter in the one place the page should stay dense.

        Rendered empty rather than conditionally: a live region has to be in the
        document before the text arrives for a screen reader to notice it
        appearing. `status` rather than `alert` — a list that did what it was
        told is worth saying and not worth interrupting for.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {said === null ? null : <span key={said.press}>{said.text}</span>}
      </p>
      <ScopeProblem problem={problem} />
      {/*
        `role="list"` on a list is normally redundant, and here it is not:
        Tailwind's reset takes the bullets off every list, and WebKit drops the
        list semantics along with them. The sequence is the one thing this
        element exists to convey — and the numbers down the left are hidden from
        assistive technology precisely because the list was meant to carry it.
      */}
      <ol
        role="list"
        className="mt-3 border-t border-zinc-200 dark:border-zinc-800"
      >
        {rows.map((deliverable, index) => (
          <DeliverableItem
            key={deliverable.id}
            deliverable={deliverable}
            position={index + 1}
            controls={
              <DeliverableControls
                deliverable={deliverable}
                position={index + 1}
                count={rows.length}
                arrange={arrange}
              />
            }
          />
        ))}
      </ol>
    </>
  );
}
