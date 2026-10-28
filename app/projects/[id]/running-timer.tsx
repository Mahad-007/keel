import type { ReactNode } from "react";

import { formatDate } from "@/lib/dates";
import {
  attributionLabel,
  entryAttribution,
  NO_NOTE_LABEL,
  type NamedDeliverable,
} from "@/lib/time/entry";
import type { RunningTimer as RunningTimerRow } from "@/lib/time/timer";

import { TimerElapsed } from "./timer-elapsed";

/**
 * The panel that stands in for the Start form while a clock is running.
 *
 * The figure leads and everything else is subordinate to it, which is the one
 * layout decision here: a reader glancing at this tab is asking one question —
 * is it running, and for how long — and the answer has to be legible from
 * across a desk. The attribution, the note and the day are the context for
 * that figure rather than fields of equal weight.
 *
 * The day is on show because it is the day the entry will be filed under, and
 * it is the only thing about a running clock a reader can be surprised by: a
 * stretch begun at 23:50 is filed under the evening it began, not the morning
 * it is stopped in. Saying so while the clock runs is better than saying it in
 * the sentence afterwards, when the row is already written.
 *
 * The presses are `children` rather than props. This component is the shell —
 * what the clock is and how long it has been going — and which buttons belong
 * beside it is the business of whatever owns the state behind them. The
 * elapsed figure arrives the same way, as a number: the counting belongs with
 * that same owner, because the sentences its buttons produce are built from
 * it.
 */
export function RunningTimerPanel({
  timer,
  minutes,
  deliverables,
  children,
}: {
  timer: RunningTimerRow;
  /** How long it has been running, counted by whoever owns the panel. */
  minutes: number;
  /**
   * This project's scope list, which the attribution is named from. The same
   * list the picker was built from, so the line named here is the line that
   * was chosen — rather than a second read that could disagree.
   */
  deliverables: readonly NamedDeliverable[];
  /** Stop, Discard, and whatever step either of them opens. */
  children: ReactNode;
}) {
  const where = entryAttribution(timer, deliverables);
  const note = timer.note?.trim() ?? "";

  return (
    <div className="mt-4 rounded border border-zinc-300 bg-zinc-50 px-4 py-3.5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <TimerElapsed minutes={minutes} />
        {/*
          "so far" rather than "elapsed": the figure is still moving, and a
          reader who looks away and back should not have to wonder whether
          they are reading a total.
        */}
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          so far, against {attributionLabel(where)}
        </span>
      </div>
      <dl className="mt-2.5 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-zinc-500 dark:text-zinc-500">Will be logged on</dt>
        <dd className="text-zinc-900 dark:text-zinc-100">
          {formatDate(timer.startedOn)}
        </dd>
        <dt className="text-zinc-500 dark:text-zinc-500">Note</dt>
        <dd
          className={
            note === ""
              ? "text-zinc-500 dark:text-zinc-500"
              : "text-zinc-900 dark:text-zinc-100"
          }
        >
          {note === "" ? NO_NOTE_LABEL : note}
        </dd>
        {/*
          Said only when it is not the ordinary case. A mark on every clock is
          a mark that says nothing, and this one is worth noticing: an unticked
          box at Start is the cheapest mistake on this tab to make and the most
          expensive to find out about on an invoice.
        */}
        {timer.billable ? null : (
          <>
            <dt className="text-zinc-500 dark:text-zinc-500">Charge</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">Not chargeable</dd>
          </>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
