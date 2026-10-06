"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { fieldId } from "@/components/form";

import type { Deliverable } from "@/lib/db/schema";
import {
  editButtonId,
  type EditDeliverableAction,
} from "@/lib/deliverables/edit";
import {
  announceScopeChange,
  applyScopeChange,
  changesScope,
  readScopeChange,
  SCOPE_NO_ANSWER,
  scopeWriteProblem,
  withdrawAnnouncement,
  type Announcement,
  type DeleteScopeAction,
  type MoveScopeAction,
  type ScopeChange,
  type ScopeWriteResult,
  type StatusScopeAction,
} from "@/lib/deliverables/arrange";
import { describeScopeList } from "@/lib/deliverables/list";
import {
  closeScopeRow,
  NO_OPEN_ROW,
  openRowStillThere,
  openScopeRow,
  scopeRowMode,
  type OpenScopeRow,
  type ScopeRowMode,
} from "@/lib/deliverables/open-row";
import { deleteButtonId, rowAfterDelete } from "@/lib/deliverables/remove";

import { DeleteDeliverablePrompt } from "./delete-deliverable-prompt";
import { DeliverableControls } from "./deliverable-controls";
import { DeliverableItem } from "./deliverable-item";
import { EditDeliverableForm } from "./edit-deliverable-form";
import { ScopeProblem } from "./scope-problem";
import { ScopeRow } from "./scope-row";

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
export function ScopeRows({
  deliverables,
  move,
  changeStatus,
  edit,
  remove,
}: {
  deliverables: readonly Deliverable[];
  /**
   * The writes, with the project already bound by the page that served them.
   * They arrive as props rather than being imported and called with a project
   * id, because an argument to a server action is wire data and a project named
   * that way is named by whoever is holding the page.
   */
  move: MoveScopeAction;
  changeStatus: StatusScopeAction;
  edit: EditDeliverableAction;
  remove: DeleteScopeAction;
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

  /*
    Which row has unfolded into something bigger than a line, and into what.
    One at a time, which is `openScopeRow`'s rule rather than this component's —
    see the module for why a list of half-open forms is not a list.
  */
  const [opened, setOpen] = useState<OpenScopeRow>(NO_OPEN_ROW);

  /*
    What is open, as the list as it now stands allows.

    A deliverable can leave the list while a row is open on it: somebody else
    deleted it, or this reader confirmed the deletion they were being asked
    about. Either way the form or the step is open on a line that is not there —
    it would offer to save a row the list cannot show, and hold the reader's
    focus inside it.

    Worked out from the rows on every render rather than put back by an effect.
    The alternative is a second copy of the answer that is briefly wrong, and
    "briefly wrong" here means one frame in which a deleted row is still
    rendering a form.
  */
  const open = openRowStillThere(
    opened,
    rows.map((row) => row.id),
  );

  const [said, setSaid] = useState<Announcement | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  /*
    Where the cursor goes once the list has been drawn again.

    A row that closes takes the control the reader was using with it — the Save
    button, the Keep button — and the browser answers that by dropping focus to
    the document, so the next Tab starts from the top of the page. On a list of
    eight lines that is a hunt back to where they were, every time.

    It cannot be done in the handler: the control to move to is the one the row
    is about to render *instead*, and it is not in the document yet. So the
    handler leaves the id here and the effect below acts on it once React has
    caught up.
  */
  const moveFocusTo = useRef<string | null>(null);
  useEffect(() => {
    const id = moveFocusTo.current;
    if (id === null) return;
    moveFocusTo.current = null;
    document.getElementById(id)?.focus();
  });

  /*
    The write the next press has to wait for.

    Presses are sent one at a time, in the order they were made. A status press
    names the status it expects to find — that is what stops it overruling
    somebody else's change — and it takes that from the row as the reader sees
    it, which during a run of presses is what the press before it asked for. Sent
    together, the second would describe a row the first had not finished writing
    and come back refused, blaming a conflict the reader caused themselves.

    Queueing rather than refusing, because every press in a run is meant: "Start"
    then "Mark done" on one line is two presses in under a second, and both are
    what the reader said. Waiting costs nothing they can see — the list already
    shows the result, and React holds each optimistic change until the action that
    was sent for it settles.
  */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  /*
    The list each press is measured against: where the line is now, so the
    sentence can say where it ends up and the list can tell a press that moves
    nothing from one that does.

    It cannot be the `rows` of the render the handler was created in. Two presses
    inside one frame — a held key, a quick double press — both see the list as it
    was before either, and the second would announce the position the first had
    just claimed. So each press advances this itself, and the effect puts it back
    in step with what is on screen once React has re-rendered: after a press that
    landed that is the same list, and after one the server refused it is the
    list the page rolled back to.
  */
  const shown = useRef<readonly Deliverable[]>(deliverables);
  useEffect(() => {
    shown.current = rows;
  }, [rows]);

  /*
    How many presses have been made, which is what numbers the sentences.

    A ref rather than the previous announcement, because the number has to be
    known to the press that allocated it and a functional update does not hand
    it back. The press carries its number as far as the write's answer, which is
    what lets a refused press take back its own sentence without touching one a
    later press has since said.
  */
  const presses = useRef(0);

  /**
   * Says something about a press, and hands back the number it was said under.
   *
   * A press with nothing to announce still takes a number. It costs nothing and
   * it keeps the caller total: every press has a number to withdraw, and one
   * that never said anything withdraws nothing, rather than the caller having to
   * carry a maybe-number to say so.
   */
  function say(text: string | null): number {
    const press = (presses.current += 1);
    if (text !== null) setSaid({ text, press });
    return press;
  }

  async function arrange(formData: FormData) {
    const change = readScopeChange(formData);
    /*
      A new press clears the last complaint first of all. Leaving it up would
      leave a red box above a list that has since done what it was told, and the
      reader would be reading it as being about the press they just made.
    */
    setProblem(null);

    /*
      A submission that describes no change it can make: a direction that is not
      one of the two, a form submitted without a button. There is nothing to
      write and nothing to tell the reader — a press that says nothing gets
      nothing done, which is the honest answer.
    */
    if (change === null) return;

    const list = shown.current;

    /*
      Said against the list as it reads now, before the change is applied: the
      sentence names where the line ends up, and `announceScopeChange` works
      that out with the same function that moves it.
    */
    const press = say(announceScopeChange(list, change));

    /*
      A press the list cannot act on: a greyed move control at the end of the
      order, or a line somebody else has deleted since the page was drawn. The
      sentence above has already said so, and there is nothing to write — the
      write would be a round trip whose answer is the list as it already reads.
    */
    if (!changesScope(list, change)) return;

    /*
      A deletion destroys the button it was pressed from, so the cursor has to
      be sent somewhere before the row goes. The line that takes its place,
      normally; the add line at the bottom of the page when there is no line
      left, which is where somebody who has just emptied a scope list is going
      next anyway.
    */
    if (change.kind === "remove") {
      /*
        The step has been answered, so it closes now rather than when the row
        goes. If it waited, a deletion the server refuses would roll the row back
        and bring the question with it — asking again about a line the reader has
        already decided on, under a message saying the line is not there.
      */
      setOpen(NO_OPEN_ROW);

      const next = rowAfterDelete(
        list.map((row) => row.id),
        change.id,
      );
      moveFocusTo.current =
        next === null ? fieldId("title") : deleteButtonId(next);
    }

    // On screen first. A press that waited for the round trip would make
    // rearranging a list feel like it had to be done one keystroke at a time.
    showChange(change);
    shown.current = applyScopeChange(list, change);

    report(await write(change), press);
  }

  /**
   * The write a press asks for, once the press before it has finished.
   *
   * It settles rather than rejecting, which is the whole reason it is a function
   * and not an inline `await`. The actions answer a failed *write* with a
   * sentence, but a call that never gets an answer at all — connection dropped,
   * tab suspended mid-request, request aborted — rejects, and a rejection thrown
   * out of a form action takes the page to an error boundary. The reader's line
   * would snap back and the explanation would be a crash, which is precisely
   * what the sentence beneath the list exists to replace.
   */
  function write(change: ScopeChange): Promise<ScopeWriteResult> {
    const turn = queue.current.then(() => send(change));
    // The queue must survive a write that fails, or every later press waits on a
    // promise that never settles — so what is kept is the handled version.
    queue.current = turn.catch(() => undefined);
    return turn.catch((error) => {
      // Nothing here a reader can act on beyond reloading, but a dropped action
      // is worth a line in the console for whoever is looking into why.
      console.error("scope press: the server never answered", error);
      return scopeWriteProblem(SCOPE_NO_ANSWER);
    });
  }

  function send(change: ScopeChange): Promise<ScopeWriteResult> {
    if (change.kind === "move") return move(change.id, change.direction);
    if (change.kind === "remove") return remove(change.id);
    return changeStatus(change.id, change.from, change.status);
  }

  /**
   * Open a row for one thing, which closes anything else that was open.
   *
   * It clears the last complaint, for the same reason a press does: a red box
   * saying nothing was written, left above a list the reader has since gone on
   * working in, reads as being about whatever they did most recently. Pressing
   * Edit or Delete is as much a new act as pressing Up.
   */
  function openRow(id: string, mode: ScopeRowMode) {
    setProblem(null);
    setOpen(openScopeRow(id, mode));
  }

  /**
   * A row is done with whatever it was open for: the save landed, the reader
   * left the editor, or they decided to keep the deliverable after all.
   *
   * Any sentence worth saying comes from the thing that was open rather than
   * from here, because only it knows what happened — and it has to be said from
   * here, because the live region is this component's and the row is about to go
   * back to being a line.
   */
  function closeRow(
    id: string,
    mode: ScopeRowMode,
    notice: string | null,
  ) {
    say(notice);
    setOpen((open) => closeScopeRow(open, id));
    // Back to the control that opened it, which is where the reader was before
    // the row unfolded and is the only place that still makes sense afterwards.
    moveFocusTo.current = mode === "edit" ? editButtonId(id) : deleteButtonId(id);
  }

  /**
   * Escape leaves whatever the list has open, writing nothing.
   *
   * It is the way out every other expanding thing on a screen has, and without
   * it the only way out of an editor is to find the Cancel button — which is
   * below the fields, so on a narrow screen it is off the bottom of them.
   * Nothing is written and nothing is saved: a reader pressing Escape over a
   * half-typed edit is asking to abandon it.
   *
   * Handled on the list rather than on each row, because only one row is ever
   * open: one listener at the top covers the editor, the deletion step and
   * anything either of them grows later, and none of them has to remember to
   * add it.
   */
  function leaveOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || open === null) return;
    closeRow(open.id, open.mode, null);
  }

  function report(result: ScopeWriteResult, press: number) {
    /*
      React has already rolled the optimistic change back by now: the action has
      settled, so the list on screen is the server's again. All that is left is
      to say why it snapped back — and to drop the sentence that said the press
      had worked, which it did not.

      Its own sentence, not whatever the live region is holding. Presses are sent
      one at a time and answered in that order, so by the time this one is refused
      a later press may already have announced something that did happen — and
      clearing that would leave the reader never told about it, because the later
      press will not say it twice.
    */
    if (result.ok) return;
    setSaid((said) => withdrawAnnouncement(said, press));
    setProblem(result.problem);
  }

  return (
    <>
      {/*
        Counted from the rows on screen rather than from the server's list,
        because a deletion shortens the list a beat before the server agrees to
        it. A count that waited would spend that beat saying there are three
        deliverables above a list showing two.
      */}
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {describeScopeList(rows.length)}
      </p>
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
        onKeyDown={leaveOnEscape}
        className="mt-3 border-t border-zinc-200 dark:border-zinc-800"
      >
        {rows.map((deliverable, index) =>
          scopeRowMode(open, deliverable.id) === "edit" ? (
            /*
              The editor replaces the line rather than appearing beside it. A row
              showing both would be the same three values twice over, and the
              reader would have to work out which copy they are changing.
            */
            <ScopeRow
              key={deliverable.id}
              align="start"
              position={index + 1}
            >
              <EditDeliverableForm
                deliverable={deliverable}
                save={edit}
                onSaved={(notice) => closeRow(deliverable.id, "edit", notice)}
                onCancel={() => closeRow(deliverable.id, "edit", null)}
              />
            </ScopeRow>
          ) : (
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
                  onEdit={() => openRow(deliverable.id, "edit")}
                  onDelete={() => openRow(deliverable.id, "confirm")}
                />
              }
              prompt={
                scopeRowMode(open, deliverable.id) === "confirm" ? (
                  <DeleteDeliverablePrompt
                    id={deliverable.id}
                    title={deliverable.title}
                    estimatedMinutes={deliverable.estimatedMinutes}
                    confirm={arrange}
                    onKeep={() => closeRow(deliverable.id, "confirm", null)}
                  />
                ) : null
              }
            />
          ),
        )}
      </ol>
    </>
  );
}
