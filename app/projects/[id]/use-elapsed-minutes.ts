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

/** What has been counted, and which clock it was counted for. */
type Reading = {
  readonly startedAt: string | null;
  readonly minutes: number;
};

export function useElapsedMinutes(
  /** The instant the clock started, or null when no clock is running. */
  startedAt: string | null,
  /** The figure the server computed, so the first render agrees with it. */
  initialMinutes: number,
): number {
  const [reading, setReading] = useState<Reading>({
    startedAt,
    minutes: initialMinutes,
  });

  /*
    A new clock starts from the server's figure rather than from the last
    one's.

    The panel is not remounted between two clocks — it is the same component,
    told about a different row — so state alone would hold the figure the
    previous clock had reached. The effect below corrects it, but only after
    the browser has painted, so a clock started where one had been running for
    three hours shows 3h for a frame, and the discard step built from the same
    number would name it.

    Adjusted during the render instead, which React answers by re-rendering
    before anything reaches the screen. Keyed on the clock the reading was
    taken for, so it happens exactly once per clock.
  */
  if (reading.startedAt !== startedAt) {
    setReading({ startedAt, minutes: initialMinutes });
  }

  useEffect(() => {
    // Nothing is running, so there is nothing to count and no interval worth
    // leaving behind on a tab somebody has left open.
    if (startedAt === null) return;
    const started = startedAt;

    /*
      Recomputed from `startedAt` rather than incremented, so a tab that was
      suspended for an hour comes back with the right figure instead of one
      short by however many ticks it missed. The same reason this does not keep
      its own elapsed time: the row is the clock, and this only reads it.
    */
    function read() {
      setReading({
        startedAt: started,
        minutes: elapsedMinutes(started, new Date()),
      });
    }

    read();
    const timer = setInterval(read, TICK_MS);
    return () => clearInterval(timer);
  }, [startedAt]);

  return reading.minutes;
}
