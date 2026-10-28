import { elapsedLabel } from "@/lib/time/timer";

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
export function TimerElapsed({ minutes }: { minutes: number }) {
  return (
    /*
      Tabular figures, so the width does not jump as the digits change. A clock
      that shifts the buttons beside it every minute is a clock that moves the
      Stop button out from under a cursor.
    */
    <span className="font-mono text-2xl tabular-nums text-zinc-900 dark:text-zinc-100">
      {elapsedLabel(minutes)}
    </span>
  );
}
