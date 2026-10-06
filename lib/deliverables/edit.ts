import type { Deliverable } from "@/lib/db/schema";
import { initialFormState } from "@/lib/forms/state";

import { deliverableFormFields, type DeliverableFormState } from "./form";

/**
 * Editing one line of a scope list: what the form holds, and what it hands
 * back.
 *
 * The validation is not here — it is `parseDeliverableForm`, the same function
 * the add line uses, because a title the add refuses is a title an edit must
 * refuse too. What is here is everything an edit needs that an add does not: a
 * form that starts from a stored row, a way of saying which row a submission
 * was aimed at, and an answer that lets the row close itself once the write
 * lands.
 */

/**
 * What a landed edit tells the page.
 *
 * The id, because the row that was editing has to know the answer was its own:
 * a scope list can have several rows and only one of them should close.
 *
 * The title as *saved*, which is not always the title the form was opened with
 * — that is the point of an edit — and is what the sentence said out loud
 * afterwards has to name.
 *
 * `changed` because a form opened and saved untouched is a real thing a reader
 * does, and it deserves a different sentence from one that wrote something.
 * Telling somebody their change was saved when there was no change is a small
 * lie that makes every other confirmation less believable.
 */
export type EditedDeliverable = {
  readonly id: string;
  readonly title: string;
  readonly changed: boolean;
};

/**
 * A form state plus what landed, the same shape the add line uses and for the
 * same reason: an edit in a row does not navigate. The reader is looking at the
 * list they are editing, so there is nowhere to redirect to and the row has to
 * learn from the state that it may close.
 */
export type EditDeliverableState = DeliverableFormState & {
  readonly saved: EditedDeliverable | null;
};

/**
 * What the form starts from: the stored line, nothing wrong with it yet. A
 * function rather than a constant, because unlike a blank add line an edit form
 * is different every time it opens.
 */
export function editDeliverableState(
  deliverable: Deliverable,
): EditDeliverableState {
  const fields = deliverableFormFields(deliverable);
  return { ...initialFormState(fields), saved: null };
}

/**
 * Saving a deliverable, with the project already bound by the page that served
 * the list — the same arrangement as the add line and the presses.
 *
 * The deliverable's id is *not* bound. One action serves every row, and which
 * row a submission was aimed at is what the submission says; the project is
 * what the page says, and the write checks that the two agree. Binding the id
 * instead would make it look protected while a `.bind` in a client component
 * serialises it in the clear anyway.
 */
export type EditDeliverableAction = (
  previous: EditDeliverableState,
  formData: FormData,
) => Promise<EditDeliverableState>;
