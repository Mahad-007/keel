import type { RunningTimerWithProject } from "@/lib/data/active-timers";
import type { TimeEntry } from "@/lib/db/schema";
import { deliverableOptions } from "@/lib/time/attribution";
import { INITIAL_LOG_TIME_STATE, type LogTimeState } from "@/lib/time/form";
import { rollUpProject, type RolledUpDeliverable } from "@/lib/time/rollup";

import { LogTimeForm } from "./log-time-form";
import { TimeList } from "./time-list";
import { TimeRollupPanel } from "./time-rollup";
import { TimerSection } from "./timer-section";
import { writeTimeEntry } from "./time-writes";

/**
 * The time tab: where the hours this engagement has actually cost get written
 * down.
 *
 * The clock leads, then the form, then the record. All three are ways of
 * answering one question — how long did this take — in the order the answer is
 * usually arrived at: the clock while the work is happening, the form when it
 * is being written up afterwards, and the record when somebody comes back to
 * check. A tab that put the record first would make the two common acts scroll
 * past it.
 *
 * It also means the two reads of the scope list are the same read: the picker
 * in the form and the attribution on every row are built from one query, so a
 * line cannot be called one thing above and another below.
 */
export function TimePanel({
  projectId,
  deliverables,
  entries,
  runningTimer,
  now,
}: {
  projectId: string;
  /**
   * This project's scope list, in agreed order. The attribution picker is
   * built from it, every row's attribution is named from it, and the rollup
   * sets each line's estimate against the time logged to it — which is why
   * the status comes along too.
   *
   * Read by the page rather than here, so every query the project page makes
   * stays in one place — and so the list the picker offers is the same list
   * the write checks a submission against.
   */
  deliverables: readonly RolledUpDeliverable[];
  /** Every stretch of work logged against this project, newest first. */
  entries: readonly TimeEntry[];
  /**
   * The clock running anywhere, or null. Not scoped to this project, because
   * only one runs at a time and one on another engagement is the reason this
   * tab cannot start its own.
   */
  runningTimer: RunningTimerWithProject | null;
  /** When the page was rendered, for the clock's opening elapsed figure. */
  now: Date;
}) {
  /*
    Narrowed to the three columns the picker and the sentence afterwards need,
    because this is what the closure below carries: a captured variable is
    serialised into the page, and capturing whole deliverable rows would put
    every description and timestamp on this project into the markup.
  */
  const offered = deliverables.map((deliverable) => ({
    id: deliverable.id,
    title: deliverable.title,
    estimatedMinutes: deliverable.estimatedMinutes,
  }));

  /*
    The project is captured here rather than bound onto the action, for the same
    reason it is on the scope tab: `.bind` serialises what it carries in the
    clear, so the project an hour gets billed to would be whatever the caller
    sent. A `"use server"` function declared in a server component is the form
    the compiler rewrites to encrypt its captured variables.

    The scope list is captured with it, so the attribution is checked against
    the lines this page actually offered rather than against a fresh read that
    might include a line nobody saw.
  */
  async function log(previous: LogTimeState, formData: FormData) {
    "use server";
    return writeTimeEntry(projectId, offered, previous, formData);
  }

  /*
    Worked out here, from the one read of the scope list and the one read of
    the entries this tab was given. A rollup computed from a second read could
    disagree with the list underneath it, and the figures in it are exactly
    the ones somebody would quote at a client.
  */
  const rollup = rollUpProject(deliverables, entries);

  return (
    <section className="mt-6">
      <TimerSection
        projectId={projectId}
        running={runningTimer}
        offered={offered}
        now={now}
      />
      {/*
        A rule above the form rather than more space: the clock and the log
        line are two different ways of doing one thing, and the eye needs to be
        told where one ends.
      */}
      <h3 className="mt-10 border-t border-zinc-200 pt-6 text-sm font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
        Log time
      </h3>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Every minute logged here counts against what this project was agreed
        for. Attributing an entry to a deliverable is optional and it is the
        part that pays off later: it is what lets the hours a line actually took
        sit beside the hours it was estimated at.
      </p>
      <LogTimeForm
        log={log}
        initialState={INITIAL_LOG_TIME_STATE}
        options={deliverableOptions(offered)}
      />
      <TimeRollupPanel rollup={rollup} />
      {/*
        The record, under a heading of its own. A rule above it rather than more
        space, because the form and the list are two different things to be
        doing and the eye needs to be told where one ends.
      */}
      <h3 className="mt-10 border-t border-zinc-200 pt-6 text-sm font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
        Logged
      </h3>
      <TimeList
        projectId={projectId}
        entries={entries}
        deliverables={offered}
      />
    </section>
  );
}
