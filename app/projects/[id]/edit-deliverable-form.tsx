"use client";

import { useActionState, useEffect } from "react";

import {
  fieldId,
  FormSummary,
  SubmitButton,
  useFirstErrorFocus,
} from "@/components/form";
import type { Deliverable } from "@/lib/db/schema";
import {
  cancelEditLabel,
  EDIT_FIELD_NAMES,
  EDIT_NO_ANSWER,
  editDeliverableState,
  editFormLabel,
  failedEditState,
  savedNotice,
  type EditDeliverableAction,
  type EditDeliverableState,
} from "@/lib/deliverables/edit";
import {
  DELIVERABLE_FIELD_NAMES,
  readDeliverableFields,
} from "@/lib/deliverables/form";

import { DeliverableFields } from "./deliverable-fields";

/**
 * One line of a scope list, open for editing.
 *
 * It replaces the line in place rather than opening a page of its own. An edit
 * to a deliverable is usually a word in a title or a number in an estimate, and
 * a navigation each way around that is three screens for a two-character
 * change — and it would lose the list, which is the thing that tells you
 * whether the change you are making is the right one.
 *
 * A client component for the same reason every other form here is one.
 * `useActionState` keeps a rejected submission's messages and what was typed,
 * which on an edit form means keeping the edit.
 */
export function EditDeliverableForm({
  deliverable,
  save,
  onSaved,
  onCancel,
}: {
  deliverable: Deliverable;
  /**
   * The write, with the project already bound by the page that served the list.
   * The row is named by the hidden field below rather than bound here: binding
   * in a client component only prepends the argument to the POST body, where it
   * is exactly as forgeable as the field is.
   */
  save: EditDeliverableAction;
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
    the dispatch and takes the page to an error boundary, which here would throw
    away the edit that had just been typed. A dropped connection, a tab suspended
    mid-request and an aborted request all reject, and so does a page left open
    across a deploy that rotated the key the captured project is encrypted with.
  */
  async function answer(
    previous: EditDeliverableState,
    formData: FormData,
  ): Promise<EditDeliverableState> {
    try {
      return await save(previous, formData);
    } catch (error) {
      // Nothing a reader can act on beyond reloading, but worth a line in the
      // console for whoever is looking into why edits are failing.
      console.error("edit deliverable: the server never answered", error);
      return failedEditState(readDeliverableFields(formData), EDIT_NO_ANSWER);
    }
  }

  /*
    A landed save is the end of the editor: the row goes back to being a line of
    the list, which is what the reader was looking at before. Leaving the form
    open would mean a second press to get out of something with nothing left to
    say.

    Told to the list from here rather than from an effect on the state. The
    state is about to belong to a component that has been unmounted — and a
    sentence put into a live region that is removed in the same breath is a
    sentence nobody hears, which is why the list owns both the region and the
    close.
  */
  async function attempt(
    previous: EditDeliverableState,
    formData: FormData,
  ): Promise<EditDeliverableState> {
    const state = await answer(previous, formData);
    const notice = savedNotice(state);
    if (notice !== null) onSaved(notice);
    return state;
  }

  const [state, formAction] = useActionState(
    attempt,
    editDeliverableState(deliverable),
  );

  // Scoped to this row: the add line at the bottom of the page renders the same
  // three fields, and an unscoped lookup would move the cursor into it.
  useFirstErrorFocus(state, DELIVERABLE_FIELD_NAMES, deliverable.id);

  /*
    The cursor goes into the title when the editor opens.

    Without it the focus stays on the Edit button, which has just been replaced
    by this form — so the reader is left focused on nothing, with a form they
    have to Tab back into from the top of the page. The title first because it
    is the field most edits are about, and because it is the first one anyway:
    anyone wanting the estimate is one Tab away.

    Keyed on the row, so it happens when this editor opens and not again — a
    rejected save moves the cursor to the field that failed, and this must not
    drag it back to the title afterwards.
  */
  useEffect(() => {
    document.getElementById(fieldId("title", deliverable.id))?.focus();
  }, [deliverable.id]);

  return (
    <form
      action={formAction}
      noValidate
      aria-label={editFormLabel(deliverable.title)}
      className="flex w-full flex-col gap-4 py-1"
    >
      {/*
        Which line is being saved. The project is not here and not in the list
        either — the page closes it over and hands down an action that already
        carries it, so neither a field of this form nor an argument from the list
        can name a project the reader was not looking at.
      */}
      <input
        type="hidden"
        name={EDIT_FIELD_NAMES.id}
        value={deliverable.id}
      />
      <FormSummary state={state} />
      <DeliverableFields state={state} scope={deliverable.id} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        {/*
          A button rather than a link: there is nowhere to go. It leaves the
          form, which is a thing that happens on this page and nothing a URL
          should be able to describe.
        */}
        <button
          type="button"
          onClick={onCancel}
          aria-label={cancelEditLabel(deliverable.title)}
          className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
