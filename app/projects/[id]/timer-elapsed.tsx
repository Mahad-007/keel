import { elapsedLabel, hasCountedMinute } from "@/lib/time/timer";

/**
 * How long the clock has been running, as the one figure this tab is read for.
 *
 * It only renders what it is given. The counting is `useElapsedMinutes`, in
 * the component that owns the panel, because the sentences beside this figure
 * are built from the same number and a second ticker would drift from it.
 *
 * It shows minutes rather than seconds, which is the unit everywhere in this
 * app and the unit the entry keeps: the figure is floored to the minute when
 * the clock stops, so seconds counting up on screen would be seconds a reader
 * watched the app discard.
 */

/**
 * A clock face: monospaced and tabular, so the width does not jump as the
 * digits change. A figure that resizes every minute is a figure that moves the
 * Stop button out from under a cursor.
 */
const COUNTED = "font-mono text-2xl tabular-nums";

/**
 * The first minute, which is a phrase rather than a duration — "Less than a
 * minute" set in a clock face reads as a label somebody forgot to replace. It
 * is still the largest thing in the panel, because it is still the answer to
 * the question the panel is for.
 */
const UNCOUNTED = "text-xl font-medium";

export function TimerElapsed({ minutes }: { minutes: number }) {
  return (
    <span
      className={`${hasCountedMinute(minutes) ? COUNTED : UNCOUNTED} text-zinc-900 dark:text-zinc-100`}
    >
      {elapsedLabel(minutes)}
    </span>
  );
}
