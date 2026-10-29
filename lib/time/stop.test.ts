import { describe, expect, it } from "vitest";

import { MAX_ENTRY_MINUTES } from "./form";
import {
  describeTimerDiscard,
  discardedTimerAnnouncement,
  discardStepOpen,
  discardTimerProblem,
  stopTimerProblem,
  STOP_TIMER_PROBLEMS,
  stoppedTimerAnnouncement,
  timerRunningTooLong,
  type StoppedTimer,
} from "./stop";

/** Ninety-five minutes against one line, stopped on the day it started. */
const STOPPED: StoppedTimer = {
  id: "tme_one",
  minutes: 95,
  workedOn: "2026-10-27",
  deliverableTitle: "Importer",
  billable: true,
};

describe("stopTimerProblem", () => {
  it("reports a refusal with nothing claimed about the clock", () => {
    const result = stopTimerProblem(STOP_TIMER_PROBLEMS.missing);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toBe(STOP_TIMER_PROBLEMS.missing);
  });
});

describe("stoppedTimerAnnouncement", () => {
  it("says the duration, the line and the day", () => {
    expect(stoppedTimerAnnouncement(STOPPED)).toBe(
      "Logged 1h 35m against “Importer” on Oct 27, 2026.",
    );
  });

  it("calls unattributed work the project itself", () => {
    expect(
      stoppedTimerAnnouncement({ ...STOPPED, deliverableTitle: null }),
    ).toBe("Logged 1h 35m against the project itself on Oct 27, 2026.");
  });

  it("says so when the entry will not be charged for", () => {
    expect(stoppedTimerAnnouncement({ ...STOPPED, billable: false })).toContain(
      "Marked as not chargeable.",
    );
  });

  it("says nothing about the charge for an ordinary entry", () => {
    expect(stoppedTimerAnnouncement(STOPPED)).not.toContain("chargeable");
  });
});

describe("timerRunningTooLong", () => {
  it("names the figure that is the explanation", () => {
    expect(timerRunningTooLong(3 * MAX_ENTRY_MINUTES)).toContain("72h");
  });

  it("names the ceiling the figure is over", () => {
    expect(timerRunningTooLong(2_000)).toContain("24 hours");
  });

  it("says to log the work against the days it was done", () => {
    expect(timerRunningTooLong(2_000)).toContain("days it was actually done");
  });
});

describe("describeTimerDiscard", () => {
  it("names what is about to be thrown away", () => {
    expect(describeTimerDiscard(95)).toContain("1h 35m");
  });

  it("offers stopping instead, which is what the reader usually meant", () => {
    expect(describeTimerDiscard(95)).toContain("stop the clock instead");
  });

  it("says nothing is lost below a minute, and offers nothing", () => {
    const sentence = describeTimerDiscard(0);

    expect(sentence).toContain("nothing is lost");
    expect(sentence).not.toContain("stop the clock instead");
  });
});

describe("discardedTimerAnnouncement", () => {
  it("names the minutes that were not logged", () => {
    expect(discardedTimerAnnouncement(95)).toBe(
      "Discarded the clock. The 1h 35m it had counted was not logged.",
    );
  });

  it("names no figure when there was none worth naming", () => {
    expect(discardedTimerAnnouncement(0)).toBe(
      "Discarded the clock. Nothing was logged.",
    );
  });
});

describe("discardTimerProblem", () => {
  it("reports a refusal in the shape a press answers with", () => {
    const result = discardTimerProblem("gone");

    expect(result).toEqual({ ok: false, problem: "gone" });
  });
});

describe("discardStepOpen", () => {
  it("is open while the clock it was opened about is the one running", () => {
    expect(discardStepOpen("tmr_one", "tmr_one")).toBe(true);
  });

  it("is closed when nobody has pressed Discard", () => {
    expect(discardStepOpen(null, "tmr_one")).toBe(false);
  });

  it("closes when the clock is stopped under it", () => {
    expect(discardStepOpen("tmr_one", null)).toBe(false);
  });

  it("closes rather than following the next clock started", () => {
    expect(discardStepOpen("tmr_one", "tmr_two")).toBe(false);
  });

  it("is closed with no clock and no press, not open about nothing", () => {
    expect(discardStepOpen(null, null)).toBe(false);
  });
});
