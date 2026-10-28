"use client";

import { useEffect, useState } from "react";

import { elapsedLabel, elapsedMinutes } from "@/lib/time/timer";

/**
 * How long the clock has been running, counting up.
 *
 * The one genuinely live thing on the page, and the reason it is a client
 * component. A figure rendered once on the server would be right for a minute
 * and then quietly wrong for the rest of the afternoon, which on a clock is
 * worse than no figure at all: the number that is supposed to prove the timer
 * is running would be the number proving it had stopped.
 *
 * It starts from a figure the server worked out, passed in, rather than from
 * `Date.now()` on the first render. The first render happens on the server as
 * well as in the browser, and two clocks a few hundred milliseconds apart
 * would disagree about the minute — which React reports as a hydration
 * mismatch and repairs by throwing the markup away.
 *
 * It ticks rather than animating a second counter. The unit is the minute
 * everywhere in this app, and a seconds display would be a precision the
 * entry it becomes cannot keep: the figure is floored to the minute when the
 * clock stops, so a reader watching seconds count up would see them discarded.
 */

/**
 * How often the figure is recomputed.
 *
 * Not sixty seconds, which sounds like the obvious answer for a figure in
 * minutes and is the wrong one: the tick and the minute boundary are not in
 * step, so a figure refreshed once a minute is on average thirty seconds
 * stale and at worst fifty-nine. Fifteen keeps it within a quarter of a minute
 * for four cheap recomputations an hour.
 */
const TICK_MS = 15_000;

export function TimerElapsed({
  startedAt,
  initialMinutes,
  onMinutes,
}: {
  /** The instant the clock started, as the row holds it. */
  startedAt: string;
  /** The figure the server computed, so the first render agrees with it. */
  initialMinutes: number;
  /**
   * Told to whoever needs the figure for something other than showing it —
   * the discard step's sentence, the announcement after a press. Without it
   * the panel would have to keep a second clock of its own, and two clocks is
   * how the sentence comes to name a different figure from the one on screen.
   */
  onMinutes?: (minutes: number) => void;
}) {
  const [minutes, setMinutes] = useState(initialMinutes);

  useEffect(() => {
    /*
      Recomputed from `startedAt` rather than incremented, so a tab that was
      suspended for an hour comes back with the right figure instead of one
      short by however many ticks it missed. The same reason this does not
      count its own elapsed time: the row is the clock, and this only reads it.
    */
    function read() {
      setMinutes(elapsedMinutes(startedAt, new Date()));
    }

    read();
    const timer = setInterval(read, TICK_MS);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    onMinutes?.(minutes);
  }, [minutes, onMinutes]);

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
