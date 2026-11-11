import { formatMinutes, MINUTES_PER_HOUR } from "@/lib/minutes";

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
