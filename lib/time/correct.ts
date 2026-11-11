import { initialFormState } from "@/lib/forms/state";
import { formatMinutes, MINUTES_PER_HOUR } from "@/lib/minutes";

import { timeEntryFormFields, type EditTimeState } from "./edit";
import { canChangeEntry, type ListedTimeEntry } from "./entry";
import type { LogTimeFormFields } from "./form";
import {
  negativeEntry,
  overlongEntry,
  type SuspectEntry,
} from "./implausible";

/**
 * The fix a flagged entry is offered, and the words around it.
 *
 * `implausible.ts` says what looks wrong. This says what to do about it, and
 * the distance between the two is deliberate: a flag is a reading of the data
 * and a correction is a guess about what somebody meant. Only one of the three
 * flags has an obvious answer, and even that one is offered rather than
 * applied — nothing here writes anything, and nothing a reader does not press
 * changes a figure.
 *
 * What the offer buys is the two keystrokes between noticing a mistake and
 * fixing it. A reader who sees `13h` where they meant `13m` has to open the
 * editor, select the box, retype the figure and save; the offer opens the
 * editor with the figure already in it, so the press that applies the fix is
 * the same Save press every other edit goes through. No second write, no
 * second set of validation, and the correction is still visible before it is
 * committed — which matters, because the guess can be wrong.
 *
 * Pure, like the rest of `lib/time/`.
 */

/**
 * Whether a figure is worth offering as a correction.
 *
 * A suggestion that would itself be flagged is not a fix, it is the next
 * complaint — and a reader who presses an offer and watches the caveat stay
 * put has been told the page does not know what it is doing. So the two ends
 * are checked: nothing at or below zero, and nothing past the twelve hours
 * that got the entry flagged in the first place.
 */
function worthOffering(minutes: number): boolean {
  if (minutes <= 0) return false;
  return !overlongEntry({ minutes });
}

/**
 * The duration a flagged entry would most likely have been, or null when
 * there is no guess worth making.
 *
 * Two guesses, one per flag that is about a single entry.
 *
 * A negative duration is the sign. `-90` is ninety minutes with a stray minus
 * in front of it — there is no other way to arrive at it, since no form here
 * accepts one — so the magnitude is the figure, and it is as close to certain
 * as this module gets.
 *
 * A stretch past twelve hours is the slipped unit, and only when it is a whole
 * number of hours. `13h` is `13m` with the `h` typed for the `m`; `13h 10m` is
 * not, because nothing in the slip would have produced the ten minutes. So the
 * second guess is narrower than the flag that raises it: a long stretch with
 * minutes on the end of it gets a caveat and no offer, which is the honest
 * answer — the reader was there and this module was not.
 *
 * Null for an overfull day, always. The day holds too many hours and nothing
 * says which of the entries on it is wrong; offering to shrink whichever one
 * the reader happened to be looking at would be a guess with no reasoning
 * behind it at all.
 */
export function suggestedMinutes(
  entry: Pick<SuspectEntry, "minutes">,
): number | null {
  if (negativeEntry(entry)) {
    const magnitude = Math.abs(entry.minutes);
    return worthOffering(magnitude) ? magnitude : null;
  }

  if (overlongEntry(entry) && entry.minutes % MINUTES_PER_HOUR === 0) {
    const slipped = entry.minutes / MINUTES_PER_HOUR;
    return worthOffering(slipped) ? slipped : null;
  }

  return null;
}

/**
 * The editor's boxes as they open on a correction: the stored entry with the
 * suggested duration in place of the one on the record.
 *
 * Only the duration moves. The day, the attribution, the note and the
 * chargeable box open holding what the row holds, because none of them is what
 * was flagged and a correction that quietly reset four fields to fix one would
 * be a worse mistake than the one it came to fix.
 *
 * The suggestion goes in as `formatMinutes` writes it, for the reason
 * `timeEntryFormFields` gives: `13m` is unambiguous in the box as well as to
 * the parser, where a bare `13` is thirteen minutes to this field and thirteen
 * of something else to a reader correcting it again.
 */
export function correctedTimeFields(
  entry: ListedTimeEntry,
  minutes: number,
): LogTimeFormFields {
  return { ...timeEntryFormFields(entry), duration: formatMinutes(minutes) };
}

/**
 * What the editor starts from when it was opened by the offer rather than by
 * Edit.
 *
 * An ordinary untouched form state: nothing is wrong with it, nothing has been
 * submitted, and it has saved nothing. The only difference from `editTimeState`
 * is the figure in one box — which is the whole of the offer, and the reason
 * the two openings are different modes of the row rather than one.
 */
export function correctTimeState(
  entry: ListedTimeEntry,
  minutes: number,
): EditTimeState {
  return {
    ...initialFormState(correctedTimeFields(entry, minutes)),
    saved: null,
  };
}

/**
 * The id the offer beside a flagged row is known by.
 *
 * Derived from the entry rather than generated, for the reason the edit and
 * delete buttons' ids are: the cursor has to come back to it when the editor
 * it opened closes, and by then the button is being rendered again for the
 * first time, so there is no ref to have kept.
 *
 * Prefixed the same way as its two neighbours, so a page holding both a scope
 * list and a time list cannot have two rows claim one id.
 */
export function correctTimeButtonId(id: string): string {
  return `time-${id}-correct`;
}

/**
 * What the offer says: the figure it would put in the box.
 *
 * The figure rather than "Fix this", because the figure is the whole offer. A
 * reader can tell at a glance whether `13m` is what they meant, and a button
 * that only says "Fix" asks them to press it to find out what it would do —
 * which, on something that changes an hour on an invoice, is the wrong way
 * round.
 */
export function correctTimeText(minutes: number): string {
  return `Correct it to ${formatMinutes(minutes)}`;
}

/**
 * The same button's accessible name, which has to say which row it is on.
 *
 * A flagged list can hold three of these and they would otherwise be three
 * controls reading "Correct it to 13m" with nothing to tell them apart.
 *
 * The visible text comes first and in full, which is not decoration: a reader
 * driving the page by voice says the words they can see, and a name that
 * replaced them rather than extending them would leave the button unreachable.
 * The same ordering `submitAriaLabel` and `exportLinkName` use, for the same
 * reason.
 */
export function correctTimeLabel(name: string, minutes: number): string {
  return `${correctTimeText(minutes)}, instead of ${name}`;
}

/**
 * What the editor says about why it opened holding something the row does not.
 *
 * Needed because the box has been changed by the page rather than by the
 * reader, which is the one thing an edit form is otherwise forbidden from
 * doing. Without a sentence saying so, a reader who pressed the offer to see
 * what it meant and then saved out of habit would have written a figure they
 * never typed.
 *
 * It names both ends — what the box was filled with and what is on the
 * record — so the decision can be made without closing the form to go and
 * look. And it names all three ways out, because the middle one is the one a
 * guess deserves: the suggestion is a guess, and the reader is the only one
 * who knows what the afternoon actually was.
 *
 * Written about the opening rather than about the box as it stands now, which
 * is the only tense it can honestly use. The sentence is fixed when the form
 * opens, and the box is not: the reader types in it, and a refused save fills
 * it back from what was submitted. A note claiming the box "holds" a figure
 * would be false the moment either happened, about the one field it exists to
 * explain.
 */
export function describeOpenedCorrection(
  storedMinutes: number,
  minutes: number,
): string {
  return `This opened with ${formatMinutes(minutes)} in the duration box rather than the ${formatMinutes(storedMinutes)} on the record — the figure this entry most likely should have been. Save to apply it, type what it really was if the guess is wrong, or cancel to leave the entry as it stands.`;
}

/**
 * The correction a row actually gets offered, which is the guess above and one
 * more condition: the entry has to be one this list can still change.
 *
 * A billed entry keeps its caveat and loses its offer, the same rule its Edit
 * and Delete buttons follow. Offering a press that the write will refuse is
 * worse than offering nothing — the caveat is still true and still worth
 * reading, and the note under the list already explains why the row has no
 * controls.
 *
 * Asked as one question so a row does not have to remember to ask two, and so
 * the answer is the figure the button needs rather than a flag it would then
 * have to look the figure up for.
 */
export function offeredCorrection(entry: ListedTimeEntry): number | null {
  if (!canChangeEntry(entry)) return null;
  return suggestedMinutes(entry);
}
