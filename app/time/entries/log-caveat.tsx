import { CaveatNote } from "@/components/form";
import {
  describeProblem,
  type EntryProblem,
  type SuspectEntry,
} from "@/lib/time/implausible";

/**
 * The rule under one entry of the log, which is a shared string because two
 * different `<tr>`s carry it.
 *
 * An unflagged entry draws its own, and a flagged one hands it to the caveat
 * underneath — otherwise the rule falls between a row and its own explanation,
 * grouping the sentence with the entry below it. `last:border-b-0` has to
 * travel with it for the same reason: whichever `<tr>` ends the day is the one
 * that must not draw a second rule over the day's own.
 */
export const LOG_ROW_RULE =
  "border-b border-zinc-100 last:border-b-0 dark:border-zinc-900";

/**
 * Why one row of the log looks wrong, in a row of its own underneath it.
 *
 * A row rather than a cell inside the row the sentence is about: the note
 * column is already the widest thing on the page and a paragraph in it would
 * push the three columns beside it into the gutter. Spanning the table keeps
 * the ledger's columns lining up down the page, which is the whole reason this
 * view is a table.
 *
 * Amber, for the reason the project page's caveat is: nothing has been refused
 * and nothing has been held back. The hours are in every figure above.
 *
 * No offer beside it, unlike the project page's. Correcting an entry means
 * choosing a line of this project's scope to attribute it to, and a log across
 * four engagements would have to read four scope lists to render one picker —
 * which is why `LogRow` has no controls either. The project name in the row is
 * the way to the form that can.
 */
export function LogCaveat({
  entry,
  problems,
  columns,
}: {
  /** The entry the sentences are about, for the figures in them. */
  entry: Pick<SuspectEntry, "minutes" | "workedOn">;
  /** What looks wrong with it. Nothing renders for an empty list. */
  problems: readonly EntryProblem[];
  /** How wide the table is, so the sentence spans all of it. */
  columns: number;
}) {
  if (problems.length === 0) return null;

  return (
    <tr className={LOG_ROW_RULE}>
      <td colSpan={columns} className="pb-2.5">
        {problems.map((problem, index) => (
          /*
            Spaced from each other but not from the cell's own padding, which
            is why the first one carries no margin. Two amber boxes flush
            together read as one box with a line through it.
          */
          <CaveatNote
            key={problem.reason}
            className={index === 0 ? undefined : "mt-1.5"}
          >
            {describeProblem(entry, problem)}
          </CaveatNote>
        ))}
      </td>
    </tr>
  );
}
