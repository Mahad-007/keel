import { formatMinutes } from "@/lib/minutes";

import type { ListedTimeEntry } from "./entry";
import { BILLABLE_VALUE, type LogTimeFormFields } from "./form";

/**
 * Editing a stretch of work already logged: what the form opens holding, and
 * what it hands back.
 *
 * The validation is not here. It is `parseLogTimeForm`, the same function the
 * log line uses, because a duration the log refuses is a duration an edit must
 * refuse too — and because the fields are rendered by the same component, so a
 * second validator would be a second set of rules behind one set of hints.
 *
 * What is here is everything an edit needs that logging does not: a form that
 * starts from a stored row, a way of saying which row a submission was aimed
 * at, the patch that is only the columns that actually moved, and an answer
 * that lets the row close itself once the write lands.
 */

/**
 * The stored entry as the form's five boxes.
 *
 * The duration goes in as `formatMinutes` writes it — `1h 30m`, `45m`, `2h` —
 * and that is a round trip rather than a coincidence: `parseDuration` strips
 * whitespace and reads both units, so every string this produces parses back
 * to the minutes it came from. Which is the property an edit form lives or
 * dies by. A reader who opens an entry, changes the note and saves must not
 * find the duration rewritten underneath them, and a prefill that did not
 * round-trip would do exactly that on every save.
 *
 * `90` would round-trip too, and is worse to be handed: the field accepts a
 * bare number as minutes, so an entry of six hours would open showing `360`
 * and a reader correcting it to `6.5` would log six and a half minutes. The
 * written form is unambiguous in the box as well as to the parser.
 *
 * The chargeable box carries the value a ticked checkbox submits, or nothing.
 * A checkbox has no third state, and `readsAsBillable` reads anything that is
 * not the exact value as unticked — so blank is how this says "not chargeable"
 * in the same words the browser would.
 */
export function timeEntryFormFields(
  entry: ListedTimeEntry,
): LogTimeFormFields {
  return {
    duration: formatMinutes(entry.minutes),
    workedOn: entry.workedOn,
    deliverable: entry.deliverableId ?? "",
    note: entry.note ?? "",
    billable: entry.billable ? BILLABLE_VALUE : "",
  };
}
