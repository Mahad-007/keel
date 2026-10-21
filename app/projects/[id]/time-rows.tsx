"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { AlertNote, fieldId } from "@/components/form";
import {
  closedRow,
  NO_OPEN_ROW,
  openedRow,
  openRowStillThere,
  rowAfterRemoval,
  rowMode,
  withdrawAnnouncement,
  type Announcement,
  type OpenRow,
  type RowMode,
} from "@/lib/rows";
import {
  deliverableOptions,
  type AttributableDeliverable,
} from "@/lib/time/attribution";
import { isChargeable } from "@/lib/time/billing";
import { describeTimeList, groupTimeByDay, totalMinutes } from "@/lib/time/days";
import {
  editAttributionOptions,
  editTimeButtonId,
  type EditTimeAction,
} from "@/lib/time/edit";
import {
  BILLED_ENTRY_NOTE,
  canChangeEntry,
  entryAttribution,
  entryName,
  type ListedTimeEntry,
} from "@/lib/time/entry";
import {
  DELETE_TIME_NO_ANSWER,
  deletedTimeAnnouncement,
  deleteTimeButtonId,
  readTimeDeletion,
  timeListWithout,
  timeWriteProblem,
  type DeleteTimeAction,
  type TimeWriteResult,
} from "@/lib/time/remove";

import { DeleteTimePrompt } from "./delete-time-prompt";
import { EditTimeForm } from "./edit-time-form";
import { TimeDayGroup } from "./time-day";
import { TimeEntryControls } from "./time-entry-controls";
import { TimeEntryItem } from "./time-entry-item";
import { TimeRow } from "./time-row";

/**
 * A project's logged time, grouped by day, with an editor and a deletion step
 * inside the rows.
 *
 * A client component, which the rest of this page is not. The reason is the
 * deletion: a confirmed press has to take the row off the screen before the
 * server has agreed to it, and nothing that renders on the server can show a
 * list it has not been sent. So the list the reader sees lives here, and the
 * server's copy arrives as a prop.
 *
 * The day totals are computed from that same list on every render, which is
 * the point of grouping here rather than above: a deletion shortens a day and
 * changes its total and every running total above it, and a heading that
 * waited for the round trip would spend that beat contradicting the rows under
 * it.
 *
 * One handler for every deletion on every row, rather than an action bound per
 * row. Each step submits a form carrying the entry it names, which is exactly
 * what a browser puts in a submission — and it leaves this component as the
 * only thing that has to know which server action answers which press.
 */
export function TimeRows({
  entries,
  deliverables,
  edit,
  remove,
}: {
  entries: readonly ListedTimeEntry[];
  /**
   * This project's scope list, in agreed order: the attribution picker inside
   * an editor is built from it, and every row's attribution is named from it.
   * One read, passed down, so the title in the row is the title the picker
   * offers.
   */
  deliverables: readonly AttributableDeliverable[];
  /**
   * The writes, with the project already bound by the page that served them.
   * They arrive as props rather than being imported and called with a project
   * id, because an argument to a server action is wire data and a project
   * named that way is named by whoever is holding the page.
   */
  edit: EditTimeAction;
  remove: DeleteTimeAction;
}) {
  /*
    The list as the reader sees it, which is the server's list minus whatever
    they have just deleted. React keeps the change until the action that was
    sent for it settles and the re-rendered page arrives, then drops it — so a
    deletion the server refuses rolls back on its own, and there is no second
    copy of the list here to get out of step.
  */
  const [rows, showDeletion] = useOptimistic<
    readonly ListedTimeEntry[],
    string
  >(entries, timeListWithout);

  /*
    Which row has unfolded into something bigger than a line, and into what.
    One at a time, which is `openedRow`'s rule rather than this component's —
    see the module for why a list of half-open forms is not a list.
  */
  const [opened, setOpen] = useState<OpenRow>(NO_OPEN_ROW);

  /*
    What is open, as the list as it now stands allows.

    An entry can leave the list while a row is open on it: somebody else
    deleted it, or this reader confirmed the deletion they were being asked
    about. Either way the form or the step is open on a row that is not there.

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
    the document, so the next Tab starts from the top of the page. In a list of
    forty entries that is a hunt back to where they were, every time.

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
    The write the next press has to wait for. Deletions are sent one at a time,
    in the order they were confirmed: two in quick succession on the same day
    are two presses the reader meant, and waiting costs nothing they can see
    because the list already shows the result.
  */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  /*
    The list each press is measured against: what is still there, so the
    sentence can count the minutes that are left and a press on a row the list
    no longer has can be recognised as one.

    It cannot be the `rows` of the render the handler was created in. Two
    presses inside one frame both see the list as it was before either, and the
    second would count a total the first had already reduced. So each press
    advances this itself, and the effect puts it back in step with what is on
    screen once React has re-rendered: after a deletion that landed that is the
    same list, and after one the server refused it is the list the page rolled
    back to.
  */
  const shown = useRef<readonly ListedTimeEntry[]>(entries);
  useEffect(() => {
    shown.current = rows;
  }, [rows]);

  /*
    How many presses have been made, which is what numbers the sentences. A ref
    rather than the previous announcement, because the number has to be known
    to the press that allocated it and a functional update does not hand it
    back.
  */
  const presses = useRef(0);

  /**
   * Says something about a press, and hands back the number it was said under.
   *
   * A press with nothing to announce still takes a number. It costs nothing and
   * it keeps the caller total: every press has a number to withdraw, and one
   * that never said anything withdraws nothing.
   */
  function say(text: string | null): number {
    const press = (presses.current += 1);
    if (text !== null) setSaid({ text, press });
    return press;
  }

  const options = deliverableOptions(deliverables);
  const days = groupTimeByDay(rows);
  /*
    The rows that carry controls, which is every row until an invoice bills
    one. Counted here because two things need it: the line above the list,
    which cannot claim every entry is editable, and the sentence under it that
    explains the rows with nothing beside them.
  */
  const changeable = rows.filter(canChangeEntry).length;

  /** One entry named the way its controls and its confirmations name it. */
  function named(entry: ListedTimeEntry): string {
    return entryName(entry, entryAttribution(entry, deliverables));
  }

  async function confirmDelete(formData: FormData) {
    /*
      A new press clears the last complaint first of all. Leaving it up would
      leave a red box above a list that has since done what it was told, and
      the reader would read it as being about the press they just made.
    */
    setProblem(null);

    const id = readTimeDeletion(formData);
    /*
      A submission that does not describe a deletion: a form submitted without
      the confirming button, a step whose row has gone. There is nothing to
      write and nothing to tell the reader.
    */
    if (id === null) return;

    const list = shown.current;
    const entry = list.find((row) => row.id === id);
    // A row the list no longer has. Somebody else deleted it, or this is a
    // second press of one button; either way what was asked for is already so.
    if (entry === undefined) return;

    /*
      The step has been answered, so it closes now rather than when the row
      goes. If it waited, a deletion the server refuses would roll the row back
      and bring the question with it — asking again about an entry the reader
      has already decided on, under a message saying it is not there.
    */
    setOpen(NO_OPEN_ROW);

    const left = timeListWithout(list, id);
    const press = say(deletedTimeAnnouncement(named(entry), totalMinutes(left)));

    /*
      A deletion destroys the button it was pressed from, so the cursor has to
      be sent somewhere before the row goes. The row that takes its place,
      normally; the duration box of the log form when there is no row left,
      which is where somebody who has just emptied a time list is going next.

      Measured over the rows that *have* controls, not over the whole list. A
      billed row renders no buttons, so sending the cursor to its Delete button
      would send it to an element that is not in the document — and the browser
      answers that by dropping focus to the document, which is the exact thing
      this is here to prevent. The deleted row is itself one of these, since it
      had a Delete button to press.
    */
    const next = rowAfterRemoval(
      list.filter(canChangeEntry).map((row) => row.id),
      id,
    );
    moveFocusTo.current =
      next === null ? fieldId("duration") : deleteTimeButtonId(next);

    // On screen first. A press that waited for the round trip would leave the
    // reader unsure whether the one irreversible thing on the page had worked.
    showDeletion(id);
    shown.current = left;

    const result = await write(id);

    /*
      A refused deletion puts the row back, which puts its Delete button back
      with it — and the cursor is by then on the *next* row's, moved there when
      the row disappeared. Left alone, the reader's next press would open the
      question for an entry they never named.

      Set before the complaint, so the render the complaint schedules is the
      one that moves the cursor.
    */
    if (!result.ok) moveFocusTo.current = deleteTimeButtonId(id);

    report(result, press);
  }

  /**
   * The write a press asks for, once the press before it has finished.
   *
   * It settles rather than rejecting, which is the whole reason it is a
   * function and not an inline `await`. The action answers a failed *write*
   * with a sentence, but a call that never gets an answer at all — connection
   * dropped, tab suspended mid-request, request aborted — rejects, and a
   * rejection thrown out of a form action takes the page to an error boundary.
   * The reader's row would snap back and the explanation would be a crash.
   */
  function write(id: string): Promise<TimeWriteResult> {
    const turn = queue.current.then(() => remove(id));
    // The queue must survive a write that fails, or every later press waits on
    // a promise that never settles — so what is kept is the handled version.
    queue.current = turn.catch(() => undefined);
    return turn.catch((error) => {
      // Nothing here a reader can act on beyond reloading, but a dropped
      // action is worth a line in the console for whoever is looking into why.
      console.error("time press: the server never answered", error);
      return timeWriteProblem(DELETE_TIME_NO_ANSWER);
    });
  }

  /**
   * Open a row for one thing, which closes anything else that was open.
   *
   * It clears the last complaint, for the same reason a press does: a red box
   * saying nothing was written, left above a list the reader has since gone on
   * working in, reads as being about whatever they did most recently.
   */
  function openRow(id: string, mode: RowMode) {
    setProblem(null);
    setOpen(openedRow(id, mode));
  }

  /**
   * A row is done with whatever it was open for: the save landed, the reader
   * left the editor, or they decided to keep the entry after all.
   *
   * Any sentence worth saying comes from the thing that was open rather than
   * from here, because only it knows what happened — and it has to be said
   * from here, because the live region is this component's and the row is
   * about to go back to being a line.
   */
  function closeRow(id: string, mode: RowMode, notice: string | null) {
    say(notice);
    setOpen((was) => closedRow(was, id));
    // Back to the control that opened it, which is where the reader was before
    // the row unfolded and the only place that still makes sense afterwards.
    moveFocusTo.current =
      mode === "edit" ? editTimeButtonId(id) : deleteTimeButtonId(id);
  }

  /**
   * Escape leaves whatever the list has open, writing nothing.
   *
   * It is the way out every other expanding thing on a screen has, and without
   * it the only way out of an editor is to find the Cancel button — which is
   * below the fields, so on a narrow screen it is off the bottom of them.
   *
   * Handled on the list rather than on each row, because only one row is ever
   * open: one listener at the top covers the editor, the deletion step and
   * anything either of them grows later.
   */
  function leaveOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || open === null) return;
    closeRow(open.id, open.mode, null);
  }

  function report(result: TimeWriteResult, press: number) {
    /*
      React has already rolled the optimistic change back by now: the action
      has settled, so the list on screen is the server's again. All that is
      left is to say why the row came back — and to drop the sentence that said
      it had gone, which it has not.

      Its own sentence, not whatever the live region is holding. Presses are
      sent one at a time and answered in that order, so by the time this one is
      refused a later press may already have announced something that did
      happen — and clearing that would leave the reader never told about it.
    */
    if (result.ok) return;
    setSaid((was) => withdrawAnnouncement(was, press));
    setProblem(result.problem);
  }

  const anyBilled = changeable < rows.length;

  return (
    <div onKeyDown={leaveOnEscape}>
      {/*
        Counted from the rows on screen rather than from the server's list,
        because a deletion shortens the list a beat before the server agrees to
        it. A count that waited would spend that beat saying there are nine
        entries above a list showing eight.
      */}
      <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">
        {describeTimeList(days, changeable)}
      </p>
      {/*
        The list changes under the reader with no page load and no form
        submission to notice, so to anyone working from a screen reader a press
        is silent. This is where it is said out loud. Hidden visually, because
        on screen the row visibly went and a sentence repeating it would be
        clutter in the one place the page should stay dense.

        Rendered empty rather than conditionally: a live region has to be in the
        document before the text arrives for a screen reader to notice it
        appearing.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {said === null ? null : <span key={said.press}>{said.text}</span>}
      </p>
      {problem === null ? null : (
        <AlertNote className="mt-4">{problem}</AlertNote>
      )}
      {days.map((day) => (
        <TimeDayGroup key={day.workedOn} day={day}>
          {day.entries.map((entry) =>
            rowMode(open, entry.id) === "edit" ? (
              /*
                The editor replaces the row rather than appearing beside it. A
                row showing both would be the same five values twice over, and
                the reader would have to work out which copy they are changing.
              */
              <TimeRow key={entry.id} align="start">
                <EditTimeForm
                  entry={entry}
                  name={named(entry)}
                  options={editAttributionOptions(entry, options)}
                  save={edit}
                  onSaved={(notice) => closeRow(entry.id, "edit", notice)}
                  onCancel={() => closeRow(entry.id, "edit", null)}
                />
              </TimeRow>
            ) : (
              <TimeEntryItem
                key={entry.id}
                entry={entry}
                where={entryAttribution(entry, deliverables)}
                controls={
                  /*
                    A billed row has no controls at all rather than controls
                    that refuse. The write refuses it too — an invoice can be
                    raised while this page is open — but offering a button that
                    always fails is worse than not offering one, and the note
                    under the list says why it is missing.
                  */
                  canChangeEntry(entry) ? (
                    <TimeEntryControls
                      id={entry.id}
                      name={named(entry)}
                      onEdit={() => openRow(entry.id, "edit")}
                      onDelete={() => openRow(entry.id, "confirm")}
                    />
                  ) : null
                }
                prompt={
                  rowMode(open, entry.id) === "confirm" ? (
                    <DeleteTimePrompt
                      id={entry.id}
                      name={named(entry)}
                      billable={isChargeable(entry)}
                      confirm={confirmDelete}
                      onKeep={() => closeRow(entry.id, "confirm", null)}
                    />
                  ) : null
                }
              />
            ),
          )}
        </TimeDayGroup>
      ))}
      {/*
        Said once, under the list, rather than on every billed row. It explains
        the rows that have no buttons beside them, which is otherwise the page
        looking broken — and it is only worth saying at all on a project that
        has invoiced something.
      */}
      {anyBilled ? (
        <p className="mt-4 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {BILLED_ENTRY_NOTE}
        </p>
      ) : null}
    </div>
  );
}
