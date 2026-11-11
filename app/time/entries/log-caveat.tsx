import { CaveatNote } from "@/components/form";
import {
  describeProblem,
  type EntryProblem,
  type SuspectEntry,
} from "@/lib/time/implausible";

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
    <tr>
      <td colSpan={columns} className="pb-2.5">
        {problems.map((problem) => (
          <CaveatNote key={problem.reason}>
            {describeProblem(entry, problem)}
          </CaveatNote>
        ))}
      </td>
    </tr>
  );
}
