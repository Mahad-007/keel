"use client";

import { useEffect, useState } from "react";

import { elapsedMinutes } from "@/lib/time/timer";

/**
 * How long a clock has been running, recounted as the browser's own clock
 * moves.
 *
 * A hook rather than state inside the figure that displays it, because two
 * things need the number and they must not disagree: the figure on screen, and
 * the sentences built from it — the discard step warning what is about to be
 * lost, the announcement afterwards saying what was. A second ticker would
 * drift a quarter of a minute from the first, which is exactly long enough for
 * the step to name a figure the panel is not showing.
 *
 * It starts from a figure the server worked out rather than from `Date.now()`
 * on the first render. The first render happens on the server as well as in
 * the browser, and two clocks a few hundred milliseconds apart would disagree
 * about the minute — which React reports as a hydration mismatch and repairs
 * by throwing the markup away.
 */

/**
 * How often the figure is recomputed.
 *
 * Not sixty seconds, which sounds like the obvious answer for a figure in
 * minutes and is the wrong one: the tick and the minute boundary are not in
 * step, so a figure refreshed once a minute is on average thirty seconds stale
 * and at worst fifty-nine. Fifteen keeps it within a quarter of a minute for
 * four cheap recomputations an hour.
 */
const TICK_MS = 15_000;

export function useElapsedMinutes(
  /** The instant the clock started, as the row holds it. */
  startedAt: string,
  /** The figure the server computed, so the first render agrees with it. */
  initialMinutes: number,
): number {
  const [minutes, setMinutes] = useState(initialMinutes);

  useEffect(() => {
    /*
      Recomputed from `startedAt` rather than incremented, so a tab that was
      suspended for an hour comes back with the right figure instead of one
      short by however many ticks it missed. The same reason this does not keep
      its own elapsed time: the row is the clock, and this only reads it.
    */
    function read() {
      setMinutes(elapsedMinutes(startedAt, new Date()));
    }

    read();
    const timer = setInterval(read, TICK_MS);
    return () => clearInterval(timer);
  }, [startedAt]);

  return minutes;
}
