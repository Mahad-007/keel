import { describe, expect, it } from "vitest";

import { MAX_ENTRY_MINUTES } from "./form";
import type { RunningTimer } from "./timer";
import {
  elapsedLabel,
  elapsedMinutes,
  MINIMUM_TIMER_MINUTES,
  stoppedTimerEntry,
  timerStopObstacle,
} from "./timer";

/** A fixed start, so every case below is arithmetic rather than a race. */
const STARTED = "2026-10-28T09:00:00.000Z";

/** `STARTED` plus a number of seconds, as the clock would read it. */
function after(seconds: number): Date {
  return new Date(Date.parse(STARTED) + seconds * 1_000);
}

describe("elapsedMinutes", () => {
  it("is zero for a timer started this instant", () => {
    expect(elapsedMinutes(STARTED, after(0))).toBe(0);
  });

  it("stays at zero until a whole minute has passed", () => {
    expect(elapsedMinutes(STARTED, after(59))).toBe(0);
  });

  it("reads one minute at sixty seconds", () => {
    expect(elapsedMinutes(STARTED, after(60))).toBe(1);
  });

  it("floors a part-minute rather than rounding it up", () => {
    expect(elapsedMinutes(STARTED, after(119))).toBe(1);
  });

  it("counts an hour and a half as ninety minutes", () => {
    expect(elapsedMinutes(STARTED, after(90 * 60))).toBe(90);
  });

  it("keeps counting past a day", () => {
    expect(elapsedMinutes(STARTED, after(26 * 60 * 60))).toBe(26 * 60);
  });
});

/**
 * The cases where the clock and the row disagree. None of them should happen,
 * and each has one reading that keeps a page renderable: a timer that says no
 * time has passed is visibly wrong, where `NaN` or a negative travels into
 * every figure derived from it.
 */
describe("elapsedMinutes on a clock that cannot be believed", () => {
  it("reads zero when the start is in the future", () => {
    expect(elapsedMinutes(STARTED, after(-600))).toBe(0);
  });

  it("reads zero rather than NaN for a start that is not a timestamp", () => {
    expect(elapsedMinutes("whenever", after(3_600))).toBe(0);
  });

  it("reads zero for a blank start", () => {
    expect(elapsedMinutes("", after(3_600))).toBe(0);
  });

  it("reads zero when the clock itself is not a moment", () => {
    expect(elapsedMinutes(STARTED, new Date(Number.NaN))).toBe(0);
  });
});

describe("timerStopObstacle", () => {
  it("refuses a timer that has not reached a minute", () => {
    expect(timerStopObstacle(0)).toBe("too-short");
  });

  it("accepts the first whole minute", () => {
    expect(timerStopObstacle(MINIMUM_TIMER_MINUTES)).toBeNull();
  });

  it("accepts an ordinary afternoon", () => {
    expect(timerStopObstacle(195)).toBeNull();
  });

  it("accepts a stretch of exactly a day", () => {
    expect(timerStopObstacle(MAX_ENTRY_MINUTES)).toBeNull();
  });

  it("refuses a clock left running past a day", () => {
    expect(timerStopObstacle(MAX_ENTRY_MINUTES + 1)).toBe("too-long");
  });

  it("refuses a weekend of elapsed time", () => {
    expect(timerStopObstacle(3 * MAX_ENTRY_MINUTES)).toBe("too-long");
  });

  /** `elapsedMinutes` cannot produce one, and a hand-edited row can. */
  it("treats a negative figure as too short rather than acceptable", () => {
    expect(timerStopObstacle(-30)).toBe("too-short");
  });
});

describe("elapsedLabel", () => {
  it("says the first minute in words rather than showing 0m", () => {
    expect(elapsedLabel(0)).toBe("Less than a minute");
  });

  it("switches to a duration once there is one", () => {
    expect(elapsedLabel(1)).toBe("1m");
  });

  it("spells an hour and a half the way the time list does", () => {
    expect(elapsedLabel(90)).toBe("1h 30m");
  });

  it("does not show a negative figure as a duration", () => {
    expect(elapsedLabel(-5)).toBe("Less than a minute");
  });
});

/** A clock started on the evening of the 27th, against one line of scope. */
const RUNNING: RunningTimer = {
  id: "tmr_one",
  projectId: "prj_one",
  deliverableId: "dlv_build",
  note: "Pairing on the importer",
  billable: true,
  startedAt: "2026-10-27T23:50:00.000Z",
  startedOn: "2026-10-27",
};

describe("stoppedTimerEntry", () => {
  it("carries the elapsed minutes it is given", () => {
    expect(stoppedTimerEntry(RUNNING, 30).minutes).toBe(30);
  });

  it("files the entry under the day the clock started", () => {
    expect(stoppedTimerEntry(RUNNING, 30).workedOn).toBe("2026-10-27");
  });

  it("keeps the attribution and the note given at Start", () => {
    expect(stoppedTimerEntry(RUNNING, 30)).toMatchObject({
      deliverableId: "dlv_build",
      note: "Pairing on the importer",
    });
  });

  it("keeps a timer marked not chargeable out of the chargeable column", () => {
    const free = { ...RUNNING, billable: false };
    expect(stoppedTimerEntry(free, 30).billable).toBe(false);
  });

  it("writes an unattributed timer as project-level work", () => {
    const loose = { ...RUNNING, deliverableId: null, note: null };
    expect(stoppedTimerEntry(loose, 12)).toMatchObject({
      deliverableId: null,
      note: null,
    });
  });
});
