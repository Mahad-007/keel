import {
  correctTimeButtonId,
  correctTimeLabel,
  correctTimeText,
} from "@/lib/time/correct";

import { RowButton } from "./row-button";

/**
 * The press that offers a corrected figure for a flagged entry.
 *
 * It writes nothing. Like Edit and Delete beside it, the press only opens
 * something on the page — the editor, holding the suggested duration — and the
 * figure is written by the Save button inside that form, through the write
 * every other edit goes through. A one-press correction would be a second
 * write with a second set of refusals, and it would change an hour on an
 * invoice without the reader seeing the day, the note or the attribution it
 * belongs to.
 *
 * The same control as the row's own buttons, for the reason `RowButton`
 * exists: three presses on one row built in two places are three presses that
 * will not stay the same size.
 */
export function CorrectTimeOffer({
  id,
  name,
  minutes,
  onCorrect,
}: {
  id: string;
  /** The entry as the whole page names it — see `entryName`. */
  name: string;
  /** The figure being offered, which is what the button says. */
  minutes: number;
  /** Open the editor on the suggestion. Nothing is submitted and nothing written. */
  onCorrect: () => void;
}) {
  return (
    <RowButton
      id={correctTimeButtonId(id)}
      onPress={onCorrect}
      label={correctTimeLabel(name, minutes)}
    >
      {correctTimeText(minutes)}
    </RowButton>
  );
}
