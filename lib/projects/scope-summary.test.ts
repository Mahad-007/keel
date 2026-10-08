import { describe, expect, it } from "vitest";

import { UNESTIMATED_LABEL } from "@/lib/deliverables/list";
import type { DeliverableStatus } from "@/lib/deliverables/status";
import { summariseScope, type ScopeLine } from "@/lib/scope";

import {
  deliveredFigure,
  describeImpliedRate,
  REMAINING_INCLUDES_STARTED,
  remainingFigure,
  describeDelivered,
  estimatedFigure,
  deliverablesPhrase,
  describeUnestimated,
  formatSharePercent,
  hoursPhrase,
} from "./scope-summary";

/**
 * A scope line, as the summary reads one: an estimate in whole minutes and
 * where the work stands.
 */
function line(
  estimatedMinutes: number,
  status: DeliverableStatus = "pending",
): ScopeLine {
  return { estimatedMinutes, status };
}

/**
 * The figures are tested against summaries the real calculation produced, not
 * against hand-written ones — a note that is right about a `ScopeSummary`
 * nothing can generate is not right about anything.
 */
function summary(lines: readonly ScopeLine[], contractValueCents = 0) {
  return summariseScope(lines, contractValueCents);
}

describe("hoursPhrase", () => {
  it("writes a whole figure with its unit", () => {
    expect(hoursPhrase(40)).toBe("40 hours");
  });

  it("writes one hour singular", () => {
    expect(hoursPhrase(1)).toBe("1 hour");
  });

  it("keeps a part of an hour as the decimal it came in as", () => {
    expect(hoursPhrase(1.5)).toBe("1.5 hours");
    expect(hoursPhrase(0.25)).toBe("0.25 hours");
  });

  it("does not round a figure that was already rounded for it", () => {
    expect(hoursPhrase(1.67)).toBe("1.67 hours");
  });

  it("writes no hours as a plural, the way nothing is spoken of", () => {
    expect(hoursPhrase(0)).toBe("0 hours");
  });
});

describe("deliverablesPhrase", () => {
  it("counts a list of several", () => {
    expect(deliverablesPhrase(5)).toBe("5 deliverables");
  });

  it("counts a list of one in the singular", () => {
    expect(deliverablesPhrase(1)).toBe("1 deliverable");
  });

  it("counts an empty list as a plural none", () => {
    expect(deliverablesPhrase(0)).toBe("0 deliverables");
  });
});

describe("formatSharePercent", () => {
  it("writes a fraction as a whole percent", () => {
    expect(formatSharePercent(0.25)).toBe("25%");
  });

  it("rounds to the nearest percent rather than cutting it off", () => {
    expect(formatSharePercent(0.306)).toBe("31%");
    expect(formatSharePercent(0.304)).toBe("30%");
  });

  it("writes nothing delivered as none of it", () => {
    expect(formatSharePercent(0)).toBe("0%");
  });

  it("writes the whole estimate delivered as all of it", () => {
    expect(formatSharePercent(1)).toBe("100%");
  });

  it("says less than a percent rather than rounding a delivery away", () => {
    expect(formatSharePercent(0.004)).toBe("less than 1%");
    expect(formatSharePercent(0.0001)).toBe("less than 1%");
  });

  it("says more than 99 percent rather than rounding a project finished", () => {
    expect(formatSharePercent(0.999)).toBe("more than 99%");
    expect(formatSharePercent(0.9951)).toBe("more than 99%");
  });

  it("keeps 100% for a scope list that really is all delivered", () => {
    expect(formatSharePercent(1)).toBe("100%");
  });

  it("does not clamp a share a bad estimate pushed over one", () => {
    expect(formatSharePercent(1.5)).toBe("150%");
  });

  it("does not clamp a share a bad estimate pushed below zero", () => {
    expect(formatSharePercent(-0.2)).toBe("-20%");
  });
});

describe("describeUnestimated", () => {
  it("says nothing when every line has been sized", () => {
    expect(describeUnestimated(5, 0)).toBeNull();
  });

  it("counts the unsized lines and says what they do to the total", () => {
    expect(describeUnestimated(5, 2)).toBe(
      "2 of 5 deliverables have no estimate, so this total does not cover the whole list.",
    );
  });

  it("agrees the verb with a single unsized line", () => {
    expect(describeUnestimated(5, 1)).toBe(
      "1 of 5 deliverables has no estimate, so this total does not cover the whole list.",
    );
  });

  it("says there is nothing to total when no line is sized at all", () => {
    expect(describeUnestimated(3, 3)).toBe(
      "No line on the list has an estimate on it, so there is nothing to total.",
    );
  });

  it("says the same of a one-line list nobody has sized", () => {
    expect(describeUnestimated(1, 1)).toBe(
      "No line on the list has an estimate on it, so there is nothing to total.",
    );
  });
});

describe("estimatedFigure", () => {
  it("totals the list and labels it as an estimate", () => {
    expect(estimatedFigure(summary([line(90), line(30)]))).toEqual({
      label: "Estimated work",
      value: "2h",
      note: null,
    });
  });

  it("writes an unsized list as not estimated rather than as no time", () => {
    const figure = estimatedFigure(summary([line(0), line(0)]));
    expect(figure.value).toBe(UNESTIMATED_LABEL);
    expect(figure.note).toBe(
      "No line on the list has an estimate on it, so there is nothing to total.",
    );
  });

  it("carries the caveat when part of the list is unsized", () => {
    const figure = estimatedFigure(summary([line(60), line(0), line(0)]));
    expect(figure.value).toBe("1h");
    expect(figure.note).toBe(
      "2 of 3 deliverables have no estimate, so this total does not cover the whole list.",
    );
  });

  it("shows the hours and minutes a mixed total comes to", () => {
    expect(estimatedFigure(summary([line(90), line(45)])).value).toBe("2h 15m");
  });

  it("shows a total driven below zero rather than hiding it", () => {
    expect(estimatedFigure(summary([line(-60)])).value).toBe("-1h");
  });
});

describe("describeDelivered", () => {
  it("counts the done lines and weights them by estimate", () => {
    const lines = [line(60, "done"), line(60), line(120)];
    expect(describeDelivered(summary(lines))).toBe(
      "1 of 3 deliverables marked done, 25% of the estimated work.",
    );
  });

  it("says nothing is done yet rather than quoting a nought percent", () => {
    expect(describeDelivered(summary([line(60), line(30)]))).toBe(
      "None of 2 deliverables is marked done yet.",
    );
  });

  it("counts a share that disagrees with the count, which is the point", () => {
    const lines = [line(60, "done"), line(60, "done"), line(600)];
    expect(describeDelivered(summary(lines))).toBe(
      "2 of 3 deliverables marked done, 17% of the estimated work.",
    );
  });

  it("says there is no share to take when nothing is estimated", () => {
    const lines = [line(0, "done"), line(0)];
    expect(describeDelivered(summary(lines))).toBe(
      "1 of 2 deliverables marked done, though the estimates do not total to anything a share can be taken of.",
    );
  });

  it("says a finished list is finished rather than counting it out", () => {
    const lines = [line(60, "done"), line(30, "done")];
    expect(describeDelivered(summary(lines))).toBe(
      "All 2 deliverables are marked done.",
    );
  });

  it("names the single line of a one-line list that is done", () => {
    expect(describeDelivered(summary([line(60, "done")]))).toBe(
      "The one deliverable on the list is marked done.",
    );
  });

  it("says a finished list is finished even where nothing was sized", () => {
    const lines = [line(0, "done"), line(0, "done")];
    expect(describeDelivered(summary(lines))).toBe(
      "All 2 deliverables are marked done.",
    );
  });

  it("says there is nothing agreed for an empty scope list", () => {
    expect(describeDelivered(summary([]))).toBe("Nothing has been agreed yet.");
  });

  it("counts a line in progress as not delivered", () => {
    const lines = [line(60, "started"), line(60, "done")];
    expect(describeDelivered(summary(lines))).toBe(
      "1 of 2 deliverables marked done, 50% of the estimated work.",
    );
  });
});

describe("deliveredFigure", () => {
  it("totals the estimates of the lines marked done", () => {
    const lines = [line(60, "done"), line(30, "done"), line(90)];
    expect(deliveredFigure(summary(lines))).toEqual({
      label: "Delivered",
      value: "1h 30m",
      note: "2 of 3 deliverables marked done, 50% of the estimated work.",
    });
  });

  it("says none yet rather than nought minutes on a sized list", () => {
    expect(deliveredFigure(summary([line(60), line(30)])).value).toBe(
      "None yet",
    );
  });

  it("says not estimated when the list was never sized", () => {
    expect(deliveredFigure(summary([line(0, "done"), line(0)])).value).toBe(
      UNESTIMATED_LABEL,
    );
  });

  it("leaves a started line out of the figure", () => {
    const lines = [line(60, "started"), line(30, "done")];
    expect(deliveredFigure(summary(lines)).value).toBe("30m");
  });
});

describe("remainingFigure", () => {
  it("totals the estimates of everything not marked done", () => {
    const lines = [line(60, "done"), line(30), line(90)];
    expect(remainingFigure(summary(lines))).toEqual({
      label: "Still to do",
      value: "2h",
      note: REMAINING_INCLUDES_STARTED,
    });
  });

  it("keeps the whole estimate of a line that is in progress", () => {
    const lines = [line(120, "started"), line(60, "done")];
    expect(remainingFigure(summary(lines)).value).toBe("2h");
  });

  it("says nothing is left on a finished list, and drops the caveat", () => {
    const lines = [line(60, "done"), line(30, "done")];
    expect(remainingFigure(summary(lines))).toEqual({
      label: "Still to do",
      value: "Nothing left",
      note: null,
    });
  });

  it("says not estimated when the list was never sized", () => {
    const figure = remainingFigure(summary([line(0), line(0, "done")]));
    expect(figure.value).toBe(UNESTIMATED_LABEL);
    expect(figure.note).toBeNull();
  });

  it("counts an unsized line as nothing left to do, not as unknown", () => {
    const lines = [line(60), line(0)];
    expect(remainingFigure(summary(lines)).value).toBe("1h");
  });
});

describe("describeImpliedRate", () => {
  it("writes the division out, contract value over hours estimated", () => {
    const text = describeImpliedRate(summary([line(2400)], 500000));
    expect(text).toBe(
      "$5,000.00 over 40 hours estimated. It moves whenever an estimate does, so it is a figure to read rather than a rate to bill at.",
    );
  });

  it("quotes the hours the estimate actually came to", () => {
    const text = describeImpliedRate(summary([line(90)], 20000));
    expect(text.startsWith("$200.00 over 1.5 hours estimated.")).toBe(true);
  });

  it("says there are no hours to divide by when nothing is estimated", () => {
    expect(describeImpliedRate(summary([line(0), line(0)], 500000))).toBe(
      "Nothing on the list is estimated, so there are no hours to divide the contract value by.",
    );
  });

  it("names the negative estimate when the list totals below zero", () => {
    expect(describeImpliedRate(summary([line(60), line(-120)], 500000))).toBe(
      "The estimates on this list total below zero, so there is no rate to work out. One of the lines has a negative number of hours on it.",
    );
  });

  it("says the same for a project with no scope list at all", () => {
    expect(describeImpliedRate(summary([], 500000))).toBe(
      "Nothing on the list is estimated, so there are no hours to divide the contract value by.",
    );
  });
});
