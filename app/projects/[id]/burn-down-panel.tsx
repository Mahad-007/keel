import { CaveatNote } from "@/components/form";

import { burnDownChart } from "@/lib/burndown/chart";
import {
  burnDownCaveats,
  BURN_DOWN_IS_WHAT_WAS_LEFT,
  describeBurnDownLine,
  describeBurnDownSpan,
  NO_LINE_WITHOUT_A_PRICE,
} from "@/lib/burndown/describe";
import type { BurnReading } from "@/lib/burndown/reading";
import { burnDownRows } from "@/lib/burndown/table";

import { BurnDownChart } from "./burn-down-chart";
import { BurnDownTable } from "./burn-down-table";

/**
 * How the money went, over time, rather than in total.
 *
 * The panel above this one answers "how much of the contract has gone"; this
 * answers "how fast, and when" — and the second question is the one a total
 * cannot be asked. An engagement at 60% consumed is comfortable if it got
 * there over five months and in trouble if it got there in a fortnight, and
 * those two are the same four figures.
 *
 * Under the figures, because the figures are what a reader came for and this
 * is the context for them. The caveats come first inside the section, where
 * the other panels on this tab put theirs: a sentence that changes how the
 * whole picture reads arrives too late underneath it.
 *
 * The table is folded away rather than absent. Most visits want the slope;
 * the ones that want a figure want all of them, at full precision, and a
 * `details` element gives both without a line of client code.
 */
export function BurnDownPanel({
  projectId,
  readings,
  today,
}: {
  /** Whose burn-down it is, which is also what its clip paths are named for. */
  projectId: string;
  /** Every stored reading, oldest first. */
  readings: readonly BurnReading[];
  /** The day the page is being rendered on, for judging the end of the line. */
  today: string;
}) {
  /*
    A project nothing has ever been logged against has no readings, and the
    section is left out entirely — the figures panel above already says the
    whole contract is still there, and a chart saying it again with no line in
    it would be a box reporting that the project is new.
  */
  if (readings.length === 0) return null;

  const chart = burnDownChart(readings);

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Burn-down
      </h3>
      {/*
        The caveats belong to the chart and are rendered with it. Both of them
        are about the picture — one names a shaded stretch and the other says
        where the line stops — so a project with no line to draw gets the
        sentence explaining that instead, and the table below marks its
        reconstructed readings in a column of its own.
      */}
      {chart === null ? (
        <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {NO_LINE_WITHOUT_A_PRICE}
        </p>
      ) : (
        <>
          {burnDownCaveats(readings, today).map((caveat) => (
            <CaveatNote key={caveat} className="mt-2">
              {caveat}
            </CaveatNote>
          ))}
          <BurnDownChart
            chart={chart}
            description={describeBurnDownLine(readings) ?? ""}
            idPrefix={`burn-down-${projectId}`}
          />
          {/*
            Under the chart rather than over it: a reader who has come for the
            slope should reach it without a paragraph in the way, and this is
            what they need on the way back out. The same place, and the same
            tone, as the sentence under the figures above.
          */}
          <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {BURN_DOWN_IS_WHAT_WAS_LEFT} {describeBurnDownSpan(readings)}
          </p>
        </>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          Readings
        </summary>
        <div className="mt-2">
          <BurnDownTable rows={burnDownRows(readings)} />
        </div>
      </details>
    </section>
  );
}
