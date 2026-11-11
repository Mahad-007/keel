import type { ReactNode } from "react";

import { CaveatNote } from "@/components/form";
import {
  describeProblem,
  type EntryProblem,
  type SuspectEntry,
} from "@/lib/time/implausible";

/**
 * Why one entry of a time list looks wrong, under the row it is about.
 *
 * Under rather than beside, for the reason the deletion step is: a caveat is a
 * full sentence and the row it belongs to is a duration, a note and two marks
 * across one line. A sentence squeezed in beside those would either wrap the
 * row into a paragraph or push the controls off the end of it.
 *
 * Amber rather than red, which is the distinction `CaveatNote` exists to draw.
 * Nothing has been refused and nothing is being held back: the entry is logged,
 * it counts towards every figure on the page, and what the sentence says is
 * that the figure may not mean what it appears to. A red box here would read
 * as a write that failed.
 *
 * One box per thing noticed, stacked, rather than one box holding two
 * sentences. A long entry on an impossible day is two separate problems, and
 * running them together would make one complaint out of two — the reader would
 * fix the duration and never learn the day still does not add up.
 */
export function TimeEntryCaveat({
  entry,
  problems,
  offer,
}: {
  /** The entry the sentences are about, for the figures in them. */
  entry: Pick<SuspectEntry, "minutes" | "workedOn">;
  /** What looks wrong with it. Nothing renders for an empty list. */
  problems: readonly EntryProblem[];
  /**
   * The press that offers a corrected figure, where there is one to offer.
   * Absent on an entry nothing can be guessed about, and on one an invoice has
   * billed — see `offeredCorrection`.
   */
  offer?: ReactNode;
}) {
  if (problems.length === 0) return null;

  return (
    <div className="w-full">
      {problems.map((problem) => (
        <CaveatNote key={problem.reason} className="mt-1.5">
          {describeProblem(entry, problem)}
        </CaveatNote>
      ))}
      {/*
        After the sentences rather than before them, so the reader has been
        told what is wrong before being offered a fix for it. A press offered
        above its own explanation is a press made without one.
      */}
      {offer === undefined ? null : <div className="mt-1.5">{offer}</div>}
    </div>
  );
}
