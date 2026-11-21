import { describe, expect, it } from "vitest";

import {
  BURN_DOWN_IS_WHAT_WAS_LEFT,
  burnDownCaveats,
  describeBurnDownLine,
  describeBurnDownSpan,
  describeLineEnd,
  describeReconstruction,
  describeStaleLine,
  hasBurnDownToShow,
  NO_LINE_WITHOUT_A_PRICE,
  RECONSTRUCTED_AT_PRESENT_FIGURES,
} from "./describe";
import { burnDownReading, type BurnReading } from "./reading";

/** One day's reading of a $5,000 engagement. */
function reading(
  onDate: string,
  burnedCents = 0,
  overrides: {
    contractValueCents?: number;
    rateCents?: number;
    origin?: string;
    loggedMinutes?: number;
  } = {},
): BurnReading {
  const rateCents = overrides.rateCents ?? 12_000;
  return burnDownReading({
    onDate,
    contractValueCents: overrides.contractValueCents ?? 500_000,
    rateCents,
    rateSource: rateCents === 0 ? "none" : "project",
    entryCount: 1,
    loggedMinutes: overrides.loggedMinutes ?? 60,
    billableMinutes: overrides.loggedMinutes ?? 60,
    burnedCents,
    chargeableCents: burnedCents,
    origin: overrides.origin ?? "recorded",
  });
}

describe("BURN_DOWN_IS_WHAT_WAS_LEFT", () => {
  it("names the subtraction the line is", () => {
    expect(BURN_DOWN_IS_WHAT_WAS_LEFT).toContain("contract value less");
  });

  it("says the line starts at the first logged day, not the agreement", () => {
    expect(BURN_DOWN_IS_WHAT_WAS_LEFT).toContain("first day time was logged");
  });
});

describe("describeBurnDownSpan", () => {
  it("counts the readings and names the days they run between", () => {
    expect(
      describeBurnDownSpan([
        reading("2026-03-01"),
        reading("2026-03-16"),
        reading("2026-03-31"),
      ]),
    ).toBe("3 readings, Mar 1 – 31, 2026.");
  });

  it("writes a single reading as the one day it is", () => {
    expect(describeBurnDownSpan([reading("2026-03-01")])).toBe(
      "One reading, on Mar 1, 2026.",
    );
  });

  it("spells out both years of a span that crosses one", () => {
    expect(
      describeBurnDownSpan([reading("2026-12-28"), reading("2027-01-03")]),
    ).toBe("2 readings, Dec 28, 2026 – Jan 3, 2027.");
  });

  it("has nothing to say about a project with no readings", () => {
    expect(describeBurnDownSpan([])).toBeNull();
  });
});

describe("describeReconstruction", () => {
  it("says nothing about a line that was measured throughout", () => {
    expect(
      describeReconstruction([reading("2026-03-01"), reading("2026-03-31")]),
    ).toBeNull();
  });

  it("names the days of the one stretch that was reconstructed", () => {
    const caveat = describeReconstruction([
      reading("2026-03-01", 0, { origin: "backfilled" }),
      reading("2026-03-16", 0, { origin: "backfilled" }),
      reading("2026-03-31"),
    ]);
    expect(caveat).toContain("The shaded stretch, Mar 1 – 16, 2026,");
    expect(caveat).toContain("reconstructed after the fact");
  });

  it("says so plainly when the whole line is a reconstruction", () => {
    const caveat = describeReconstruction([
      reading("2026-03-01", 0, { origin: "backfilled" }),
      reading("2026-03-31", 0, { origin: "backfilled" }),
    ]);
    expect(caveat).toContain("Every reading on this chart");
    expect(caveat).not.toContain("shaded");
  });

  it("counts the stretches when a gap was repaired later", () => {
    const caveat = describeReconstruction([
      reading("2026-03-01", 0, { origin: "backfilled" }),
      reading("2026-03-09"),
      reading("2026-03-16", 0, { origin: "backfilled" }),
      reading("2026-03-31"),
    ]);
    expect(caveat).toContain("The 2 shaded stretches were");
  });

  it("always explains what a reconstruction cannot know", () => {
    const lines = [
      [reading("2026-03-01", 0, { origin: "backfilled" })],
      [
        reading("2026-03-01", 0, { origin: "backfilled" }),
        reading("2026-03-31"),
      ],
      [
        reading("2026-03-01", 0, { origin: "backfilled" }),
        reading("2026-03-09"),
        reading("2026-03-16", 0, { origin: "backfilled" }),
      ],
    ];
    for (const line of lines) {
      expect(describeReconstruction(line)).toContain(
        RECONSTRUCTED_AT_PRESENT_FIGURES,
      );
    }
  });

  it("does not cast doubt on the hours themselves", () => {
    expect(RECONSTRUCTED_AT_PRESENT_FIGURES).toContain(
      "The hours are the hours that were logged",
    );
  });

  it("says nothing about a project with no readings", () => {
    expect(describeReconstruction([])).toBeNull();
  });
});

describe("describeStaleLine", () => {
  const line = [reading("2026-03-01"), reading("2026-03-31")];

  it("says nothing when the last reading is today's", () => {
    expect(describeStaleLine(line, "2026-03-31")).toBeNull();
  });

  it("says nothing the morning after, before the day is read", () => {
    expect(describeStaleLine(line, "2026-04-01")).toBeNull();
  });

  it("names the day and the gap once the line falls behind", () => {
    expect(describeStaleLine(line, "2026-04-03")).toBe(
      "The line stops at Mar 31, 2026, 3 days ago. No reading has been " +
        "stored for this project since, so the chart says nothing about the " +
        "days after it.",
    );
  });

  it("counts the gap across a month boundary", () => {
    expect(describeStaleLine(line, "2026-04-30")).toContain("30 days ago");
  });

  it("does not guess why the line stopped", () => {
    const note = describeStaleLine(line, "2026-04-30");
    expect(note).not.toContain("abandoned");
    expect(note).not.toContain("finished");
  });

  it("claims a missing reading, not a missing time entry", () => {
    // The figures panel above reads the entries live and may be showing work
    // done since; a chart claiming nothing was logged would contradict it.
    const note = describeStaleLine(line, "2026-04-30");
    expect(note).toContain("No reading has been stored");
    expect(note).not.toContain("logged");
  });

  it("says nothing about a project with no readings", () => {
    expect(describeStaleLine([], "2026-04-30")).toBeNull();
  });

  it("says nothing about a line whose last reading is ahead of today", () => {
    expect(describeStaleLine(line, "2026-03-01")).toBeNull();
  });
});

describe("describeBurnDownLine", () => {
  it("names the direction, both ends and both amounts", () => {
    expect(
      describeBurnDownLine([
        reading("2026-03-01", 0),
        reading("2026-03-31", 250_000),
      ]),
    ).toBe(
      "Falling from $5,000.00 left on Mar 1, 2026 to $2,500.00 on Mar 31, 2026.",
    );
  });

  it("calls a line that gave money back a rising one", () => {
    // A corrected or deleted time entry hands back money already spent.
    expect(
      describeBurnDownLine([
        reading("2026-03-01", 250_000),
        reading("2026-03-31", 100_000),
      ]),
    ).toContain("Rising from $2,500.00 left");
  });

  it("calls a line that never moved flat", () => {
    expect(
      describeBurnDownLine([
        reading("2026-03-01", 100_000),
        reading("2026-03-31", 100_000),
      ]),
    ).toBe("Flat at $4,000.00 left, from Mar 1, 2026 to Mar 31, 2026.");
  });

  it("spells an overrun out as the amount it is over by", () => {
    const sentence = describeBurnDownLine([
      reading("2026-03-01", 0),
      reading("2026-03-31", 620_000),
    ]);
    expect(sentence).toContain("to -$1,200.00 on Mar 31, 2026.");
    expect(sentence).toContain("That is $1,200.00 past the contract value.");
  });

  it("describes a single reading as the one measurement it is", () => {
    expect(describeBurnDownLine([reading("2026-03-01", 100_000)])).toBe(
      "One reading: $4,000.00 of $5,000.00 left at the end of Mar 1, 2026.",
    );
  });

  it("has nothing to describe for a project with no readings", () => {
    expect(describeBurnDownLine([])).toBeNull();
  });
});

describe("describeLineEnd", () => {
  it("says how much is left while there is some", () => {
    expect(describeLineEnd(reading("2026-03-31", 250_000))).toBe(
      "$2,500.00 left",
    );
  });

  it("says how much it is over once there is not", () => {
    expect(describeLineEnd(reading("2026-03-31", 620_000))).toBe(
      "$1,200.00 over",
    );
  });

  it("calls an exhausted budget nothing left rather than nothing over", () => {
    expect(describeLineEnd(reading("2026-03-31", 500_000))).toBe("$0.00 left");
  });

  it("never prints a currency figure with a minus sign in front", () => {
    for (const burned of [0, 250_000, 500_000, 620_000]) {
      expect(describeLineEnd(reading("2026-03-31", burned))).not.toContain("-");
    }
  });
});

describe("burnDownCaveats", () => {
  it("says nothing about a measured, current line", () => {
    expect(
      burnDownCaveats(
        [reading("2026-03-01"), reading("2026-03-31")],
        "2026-03-31",
      ),
    ).toEqual([]);
  });

  it("raises the reconstruction before the staleness", () => {
    const caveats = burnDownCaveats(
      [
        reading("2026-03-01", 0, { origin: "backfilled" }),
        reading("2026-03-31"),
      ],
      "2026-04-30",
    );
    expect(caveats).toHaveLength(2);
    expect(caveats[0]).toContain("reconstructed");
    expect(caveats[1]).toContain("The line stops at");
  });

  it("raises only the one that applies", () => {
    const reconstructed = burnDownCaveats(
      [
        reading("2026-03-01", 0, { origin: "backfilled" }),
        reading("2026-03-31"),
      ],
      "2026-03-31",
    );
    expect(reconstructed).toHaveLength(1);
    expect(reconstructed[0]).toContain("reconstructed");

    const stale = burnDownCaveats(
      [reading("2026-03-01"), reading("2026-03-31")],
      "2026-04-30",
    );
    expect(stale).toHaveLength(1);
    expect(stale[0]).toContain("The line stops at");
  });

  it("has nothing to raise about a project with no readings", () => {
    expect(burnDownCaveats([], "2026-04-30")).toEqual([]);
  });
});

describe("NO_LINE_WITHOUT_A_PRICE", () => {
  it("names the missing price rather than blaming the readings", () => {
    expect(NO_LINE_WITHOUT_A_PRICE).toContain("no contract value");
  });

  it("points at the readings that do exist", () => {
    expect(NO_LINE_WITHOUT_A_PRICE).toContain("listed below");
  });
});

describe("hasBurnDownToShow", () => {
  it("shows a project with hours behind it", () => {
    expect(hasBurnDownToShow([reading("2026-03-01", 60_000)])).toBe(true);
  });

  it("shows nothing for a project with no readings", () => {
    expect(hasBurnDownToShow([])).toBe(false);
  });

  it("shows nothing when every reading is a day nobody worked", () => {
    // A reading is taken for the day the page is opened on, so a project
    // nobody has logged against collects a row a day saying nothing happened.
    expect(
      hasBurnDownToShow([
        reading("2026-03-01", 0, { loggedMinutes: 0 }),
        reading("2026-03-02", 0, { loggedMinutes: 0 }),
      ]),
    ).toBe(false);
  });

  it("shows a line once one day of work is behind it", () => {
    expect(
      hasBurnDownToShow([
        reading("2026-03-01", 0, { loggedMinutes: 0 }),
        reading("2026-03-02", 60_000, { loggedMinutes: 30 }),
      ]),
    ).toBe(true);
  });

  it("keeps the flat line of hours that bill for nothing", () => {
    // A rate of zero is a real finding, not an empty chart: somebody has
    // worked a fortnight on an engagement that charges for none of it.
    expect(
      hasBurnDownToShow([reading("2026-03-01", 0, { rateCents: 0 })]),
    ).toBe(true);
  });
});
