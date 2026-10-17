import { deliverableOptions } from "@/lib/time/attribution";
import {
  INITIAL_LOG_TIME_STATE,
  type LogTimeState,
} from "@/lib/time/form";

import { LogTimeForm } from "./log-time-form";
import { writeTimeEntry } from "./time-writes";

/**
 * The time tab: where the hours this engagement has actually cost get written
 * down.
 *
 * The form leads, and for now it is all there is. That order is not a
 * placeholder for a list arriving later — logging is what somebody opens this
 * tab to do, several times a day, and the reading of what has been logged is
 * what they open it for occasionally. A page that puts the record first makes
 * the common act scroll.
 */
export function TimePanel({
  projectId,
  deliverables,
}: {
  projectId: string;
  /**
   * This project's scope list, in agreed order, for the attribution picker.
   * Read by the page rather than here, so every query the project page makes
   * stays in one place — and so the list the picker offers is the same list
   * the write checks a submission against.
   */
  deliverables: readonly {
    id: string;
    title: string;
    estimatedMinutes: number;
  }[];
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

  return (
    <section className="mt-6">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Log time
      </h3>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Every minute logged here counts against what this project was agreed
        for. Attributing an entry to a deliverable is optional and it is the
        part that pays off later: it is what lets the hours a line actually
        took sit beside the hours it was estimated at.
      </p>
      <LogTimeForm
        log={log}
        initialState={INITIAL_LOG_TIME_STATE}
        options={deliverableOptions(offered)}
      />
    </section>
  );
}
