import { deliverableOptions } from "@/lib/time/attribution";
import type { AttributableDeliverable } from "@/lib/time/attribution";
import type { StartTimerState } from "@/lib/time/start";
import { elapsedMinutes, type RunningTimer } from "@/lib/time/timer";

import { TimerControls } from "./timer-controls";
import { TimerElsewhere } from "./timer-elsewhere";
import {
  writeTimerDiscard,
  writeTimerStart,
  writeTimerStop,
} from "./timer-writes";

/**
 * The top of the time tab: the clock, in whichever of its three states this
 * project is in.
 *
 * The clock leads the tab, above the form that logs time by hand. Starting one
 * is the act somebody performs at the beginning of a stretch of work, which is
 * before they know anything a form could ask them — and the whole argument for
 * the feature is that writing time up afterwards rounds to the half hour and
 * rounds downwards.
 *
 * The three states are decided here rather than inside the controls, because
 * two of them are a page-level fact: a clock running on another project is not
 * something this project's controls can do anything with, so what they get is
 * a null and the sentence is rendered instead of them.
 */
export function TimerSection({
  projectId,
  running,
  offered,
  now,
}: {
  projectId: string;
  /**
   * The clock running anywhere, with the name of the project it is on, or
   * null. Read by the page rather than here, so every query the project page
   * makes stays in one place.
   */
  running: (RunningTimer & { projectName: string }) | null;
  /**
   * This project's scope list, in agreed order. The picker is built from it,
   * a running clock's attribution is named from it, and the write checks a
   * submission against it.
   */
  offered: readonly AttributableDeliverable[];
  /**
   * The instant the page was rendered, for the elapsed figure the browser
   * then counts on from. Passed in rather than read here so the figure and
   * everything else on the page agree about when "now" was.
   */
  now: Date;
}) {
  /*
    The project and the scope list are captured here rather than bound onto
    the actions, for the reason given in `timer-writes.ts`: `.bind` serialises
    what it carries in the clear, so the project a clock is started against
    would be whatever the caller sent. A `"use server"` function declared in a
    server component is the form the compiler rewrites to encrypt its captured
    variables.
  */
  async function start(previous: StartTimerState, formData: FormData) {
    "use server";
    return writeTimerStart(projectId, offered, previous, formData);
  }

  async function stop(id: string) {
    "use server";
    return writeTimerStop(projectId, offered, id);
  }

  async function discard(id: string) {
    "use server";
    return writeTimerDiscard(projectId, id);
  }

  const here = running !== null && running.projectId === projectId;

  return (
    <section className="mt-6">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Clock
      </h3>
      <p className="mt-1 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Start a clock when you start the work and stop it when you stop. It
        survives a reload, a closed laptop and a restart, because it is a row
        rather than something this page is remembering — and the entry it writes
        is an ordinary one you can correct afterwards.
      </p>
      {running !== null && !here ? (
        <TimerElsewhere
          projectId={running.projectId}
          projectName={running.projectName}
        />
      ) : (
        <TimerControls
          running={here ? running : null}
          initialMinutes={
            here && running !== null
              ? elapsedMinutes(running.startedAt, now)
              : 0
          }
          options={deliverableOptions(offered)}
          deliverables={offered}
          start={start}
          stop={stop}
          discard={discard}
        />
      )}
    </section>
  );
}
