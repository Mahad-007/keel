"use client";

import { useActionState, useEffect } from "react";

import {
  fieldId,
  FormSummary,
  SubmitButton,
  useFirstErrorFocus,
} from "@/components/form";
import type { DeliverableOption } from "@/lib/time/attribution";
import {
  cancelTimeEditLabel,
  EDIT_TIME_FIELD_NAMES,
  EDIT_TIME_NO_ANSWER,
  editTimeFormLabel,
  editTimeState,
  failedTimeEditState,
  savedTimeNotice,
  type EditTimeAction,
  type EditTimeState,
} from "@/lib/time/edit";
import type { ListedTimeEntry } from "@/lib/time/entry";
import { LOG_TIME_FIELD_NAMES, readLogTimeFields } from "@/lib/time/form";

import { LogTimeFields } from "./time-fields";

/**
 * One entry of a time list, open for editing.
 *
 * It replaces the row in place rather than opening a page of its own. An edit
 * to a logged stretch of work is usually a figure or a word — ninety minutes
 * that were really two hours, the line of scope it should have gone against —
 * and a navigation each way around that is three screens for a two-character
 * change. It would also lose the day's total, which is the thing that tells
 * you whether the correction you are making is the right one.
 *
 * A client component for the same reason every other form here is one.
 * `useActionState` keeps a rejected submission's messages and what was typed,
 * which on an edit form means keeping the edit.
 */
export function EditTimeForm({
  entry,
  name,
  options,
  save,
  onSaved,
  onCancel,
}: {
  entry: ListedTimeEntry;
  /** The entry as the whole page names it — see `entryName`. */
  name: string;
  /** The deliverables this project has, for the attribution picker. */
  options: readonly DeliverableOption[];
  /**
   * The write, with the project and its scope list already captured by the
   * page that served the list. The entry is named by the hidden field below
   * rather than captured here: a `.bind` in a client component only prepends
   * the argument to the POST body, where it is exactly as forgeable as the
   * field is.
   */
  save: EditTimeAction;
  /**
   * The save landed. The list closes the row and says the sentence, because
   * both outlive this component — it is about to be unmounted, and a live
   * region that is removed in the same breath as it is filled says nothing.
   */
  onSaved: (notice: string) => void;
  /** The reader is done editing and nothing was written. */
  onCancel: () => void;
}) {
  /*
    The save has to come back with a state even when the call itself fails.

    `useActionState` has no answer for a rejected action: the rejection escapes
    the dispatch and takes the page to an error boundary, which here would
    throw away the correction that had just been typed. A dropped connection, a
    tab suspended mid-request and an aborted request all reject, and so does a
    page left open across a deploy that rotated the key the captured project is
    encrypted with.
  */
  async function answer(
    previous: EditTimeState,
    formData: FormData,
  ): Promise<EditTimeState> {
    try {
      return await save(previous, formData);
    } catch (error) {
      // Nothing a reader can act on beyond reloading, but worth a line in the
      // console for whoever is looking into why edits are failing.
      console.error("edit time entry: the server never answered", error);
      return failedTimeEditState(
        readLogTimeFields(formData),
        EDIT_TIME_NO_ANSWER,
      );
    }
  }

  /*
    A landed save is the end of the editor: the row goes back to being a line
    of the list, which is what the reader was looking at before. Leaving the
    form open would mean a second press to get out of something with nothing
    left to say.

    Told to the list from here rather than from an effect on the state. The
    state is about to belong to a component that has been unmounted — and a
    sentence put into a live region that is removed in the same breath is a
    sentence nobody hears, which is why the list owns both the region and the
    close.
  */
  async function attempt(
    previous: EditTimeState,
    formData: FormData,
  ): Promise<EditTimeState> {
    const state = await answer(previous, formData);
    const notice = savedTimeNotice(state);
    if (notice !== null) onSaved(notice);
    return state;
  }

  const [state, formAction, saving] = useActionState(
    attempt,
    editTimeState(entry),
  );

  // Scoped to this row: the log line at the top of the tab renders the same
  // five fields, and an unscoped lookup would move the cursor into it.
  useFirstErrorFocus(state, LOG_TIME_FIELD_NAMES, entry.id);

  /*
    The cursor goes into the duration when the editor opens.

    Without it the focus stays on the Edit button, which has just been replaced
    by this form — so the reader is left focused on nothing, with a form they
    have to Tab back into from the top of the page. The duration first because
    it is the field most corrections are about, and because it is the first one
    anyway: anyone wanting the day is one Tab away.

    Keyed on the row, so it happens when this editor opens and not again — a
    rejected save moves the cursor to the field that failed, and this must not
    drag it back to the duration afterwards.
  */
  useEffect(() => {
    document.getElementById(fieldId("duration", entry.id))?.focus();
  }, [entry.id]);

  return (
    <form
      action={formAction}
      noValidate
      aria-label={editTimeFormLabel(name)}
      className="flex w-full flex-col gap-4 py-1"
    >
      {/*
        Which entry is being saved. The project is not here and not in the list
        either — the page closes it over and hands down an action that already
        carries it, so neither a field of this form nor an argument from the
        list can name a project the reader was not looking at.
      */}
      <input type="hidden" name={EDIT_TIME_FIELD_NAMES.id} value={entry.id} />
      <FormSummary state={state} />
      <LogTimeFields state={state} options={options} scope={entry.id} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        {/*
          A button rather than a link: there is nowhere to go. It leaves the
          form, which is a thing that happens on this page and nothing a URL
          should be able to describe.
        */}
        {/*
          Disabled rather than hidden while the save is in flight, so the way
          out stays where the reader last saw it. `disabled` and not
          `aria-disabled` here, unlike the row's own controls: this press has
          to be refused rather than reported, and the state it would leave
          behind lasts only as long as the request.

          It is one of several ways out, and the only one this form owns — the
          list holds the rest while a save is outstanding, for the reason
          written out at `holdsOpenRow`. A refusal has nowhere to be shown
          once this component is unmounted.
        */}
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          aria-label={cancelTimeEditLabel(name)}
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400 dark:text-zinc-400 dark:hover:text-zinc-100 dark:disabled:text-zinc-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
