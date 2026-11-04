import { cellErrorDomId } from "@/lib/time/grid";
import { describeCellProblem, type RefusedCell } from "@/lib/time/timesheet";

/**
 * Why a refused sheet was refused, a cell at a time, under the grid.
 *
 * Under the grid rather than inside the cells, and that is a layout decision
 * rather than a shortcut. A duration message is a full sentence — "A fraction
 * on its own could be minutes or hours…" — and a day column is sixty pixels
 * wide: a sentence rendered in a cell would either wrap into a paragraph the
 * height of the row or widen one column and squash the other six, for a
 * message that is about one press and gone on the next.
 *
 * Each line carries the id its own box points at with `aria-describedby`, so a
 * reader who arrows onto a refused cell hears why it was refused even though
 * the words are not in the cell. That is the only reason the ids are derived
 * from the project and the day rather than generated.
 *
 * Rendered as a list because the count matters: three red boxes on a sheet of
 * forty is three things to go and fix, and a reader who has fixed two needs to
 * know there is one left.
 */
export function CellProblems({ refused }: { refused: readonly RefusedCell[] }) {
  if (refused.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-col gap-1 text-sm text-red-700 dark:text-red-400">
      {refused.map(({ project, cell, message }) => (
        <li
          key={cellErrorDomId(project.id, cell.workedOn)}
          id={cellErrorDomId(project.id, cell.workedOn)}
        >
          {describeCellProblem(project, cell, message)}
        </li>
      ))}
    </ul>
  );
}
