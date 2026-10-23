import { describe, expect, it } from "vitest";

import {
  againstEstimateFigure,
  describeAgainstEstimate,
  describeLogged,
  describeNotChargeable,
  describeShare,
  describeRollupTable,
  describeUnmatchedTime,
  describeVariance,
  estimatedFigure,
  loggedFigure,
  describeNegativeEstimates,
  rollupFigures,
  rollupProblems,
  rollupRow,
  unattributedFigure,
  DONE_WITH_NOTHING_LOGGED,
  NO_ESTIMATE_TO_COMPARE,
  NOTHING_LOGGED_LABEL,
  ON_THE_ESTIMATE_LABEL,
} from "./time-rollup";

import type { DeliverableRollup, ProjectRollup } from "@/lib/time/rollup";

function rolled(fields: Partial<DeliverableRollup> = {}): DeliverableRollup {
  return {
    deliverableId: "dlv_a",
    title: "Homepage build",
    delivered: false,
    entryCount: 2,
    loggedMinutes: 360,
    billableMinutes: 360,
    estimatedMinutes: 240,
    varianceMinutes: 120,
    loggedShare: 1.5,
    ...fields,
  };
}

function compared(fields: {
  loggedMinutes: number;
  estimatedMinutes: number;
  varianceMinutes: number | null;
  loggedShare: number | null;
}) {
  return fields;
}

function project(fields: Partial<ProjectRollup> = {}): ProjectRollup {
  return {
    lines: [],
    unattributed: { entryCount: 0, loggedMinutes: 0, billableMinutes: 0 },
    unmatchedMinutes: 0,
    entryCount: 3,
    loggedMinutes: 435,
    billableMinutes: 435,
    estimatedMinutes: 360,
    varianceMinutes: 75,
    loggedShare: 435 / 360,
    ...fields,
  };
}

describe("a logged total as its cell reads", () => {
  it("reads a duration as hours and minutes", () => {
    expect(describeLogged(390)).toBe("6h 30m");
  });

  it("says nothing has been logged rather than printing a zero duration", () => {
    // `0m` reads as a measurement where the truth is an absence.
    expect(describeLogged(0)).toBe(NOTHING_LOGGED_LABEL);
  });

  it("reads a figure under an hour in minutes", () => {
    expect(describeLogged(45)).toBe("45m");
  });
});

describe("the words for a difference against an estimate", () => {
  it("says how far over a line has run", () => {
    expect(describeVariance(150, false)).toBe("2h 30m over");
  });

  it("says over the same way whether or not the line is done", () => {
    expect(describeVariance(150, true)).toBe("2h 30m over");
  });

  it("gives a line sitting exactly on its estimate its own words", () => {
    // "0m over" is true and nobody reads it as "this one is fine".
    expect(describeVariance(0, false)).toBe(ON_THE_ESTIMATE_LABEL);
    expect(describeVariance(0, true)).toBe(ON_THE_ESTIMATE_LABEL);
  });

  it("calls unspent estimate on an open line budget left", () => {
    expect(describeVariance(-60, false)).toBe("1h left");
  });

  it("calls the same figure on a delivered line coming in under", () => {
    // Budget to spend and budget never needed are opposite news.
    expect(describeVariance(-60, true)).toBe("1h under");
  });

  it("takes the sign off, because the direction is in the word", () => {
    expect(describeVariance(-90, false)).not.toContain("-");
  });
});

describe("the share of an estimate that has gone", () => {
  it("says how much of the estimate a line has used", () => {
    expect(describeShare(1.5)).toBe("150% of it");
  });

  it("rounds the way the scope summary's share rounds", () => {
    expect(describeShare(0.254)).toBe("25% of it");
  });

  it("keeps a runaway line's share rather than capping it", () => {
    expect(describeShare(4)).toBe("400% of it");
  });

  it("says nothing when there was no estimate to take a share of", () => {
    expect(describeShare(null)).toBeNull();
  });

  it("says nothing at nought, which the logged column has already said", () => {
    expect(describeShare(0)).toBeNull();
  });

  it("says nothing at exactly one, which is what on-the-estimate means", () => {
    expect(describeShare(1)).toBeNull();
  });

  it("does not round a line barely started up to nothing", () => {
    // A half-day against a three-month estimate really is less than 1%.
    expect(describeShare(0.001)).toBe("less than 1% of it");
  });

  it("does not round a line short of its estimate up to all of it", () => {
    expect(describeShare(0.999)).toBe("more than 99% of it");
  });
});

describe("a line's whole comparison in one cell", () => {
  it("puts the difference and the share either side of a dot", () => {
    expect(
      describeAgainstEstimate(
        compared({
          loggedMinutes: 360,
          estimatedMinutes: 240,
          varianceMinutes: 120,
          loggedShare: 1.5,
        }),
        false,
      ),
    ).toBe("2h over · 150% of it");
  });

  it("leaves the share off where it would repeat the difference", () => {
    expect(
      describeAgainstEstimate(
        compared({
          loggedMinutes: 240,
          estimatedMinutes: 240,
          varianceMinutes: 0,
          loggedShare: 1,
        }),
        false,
      ),
    ).toBe(ON_THE_ESTIMATE_LABEL);
  });

  it("says there is nothing to compare on a line nobody sized", () => {
    expect(
      describeAgainstEstimate(
        compared({
          loggedMinutes: 480,
          estimatedMinutes: 0,
          varianceMinutes: null,
          loggedShare: null,
        }),
        false,
      ),
    ).toBe(NO_ESTIMATE_TO_COMPARE);
  });

  it("refuses to call a delivered line with no hours a win", () => {
    // The arithmetic would say it came in under by the whole estimate, which
    // is the most flattering sentence here and almost never the true one.
    expect(
      describeAgainstEstimate(
        compared({
          loggedMinutes: 0,
          estimatedMinutes: 240,
          varianceMinutes: -240,
          loggedShare: 0,
        }),
        true,
      ),
    ).toBe(DONE_WITH_NOTHING_LOGGED);
  });

  it("still reports an open line with no hours as its estimate left", () => {
    expect(
      describeAgainstEstimate(
        compared({
          loggedMinutes: 0,
          estimatedMinutes: 240,
          varianceMinutes: -240,
          loggedShare: 0,
        }),
        false,
      ),
    ).toBe("4h left");
  });

  it("says a delivered line came in under rather than having budget left", () => {
    expect(
      describeAgainstEstimate(
        compared({
          loggedMinutes: 180,
          estimatedMinutes: 240,
          varianceMinutes: -60,
          loggedShare: 0.75,
        }),
        true,
      ),
    ).toBe("1h under · 75% of it");
  });

  it("keeps the difference and drops the share on a negative estimate", () => {
    expect(
      describeAgainstEstimate(
        compared({
          loggedMinutes: 60,
          estimatedMinutes: -120,
          varianceMinutes: 180,
          loggedShare: null,
        }),
        false,
      ),
    ).toBe("3h over");
  });
});

describe("the part of a row's time that will not be invoiced", () => {
  it("says nothing when all of it is chargeable", () => {
    expect(
      describeNotChargeable({
        entryCount: 3,
        loggedMinutes: 360,
        billableMinutes: 360,
      }),
    ).toBeNull();
  });

  it("says nothing on a row with no time against it", () => {
    expect(
      describeNotChargeable({
        entryCount: 0,
        loggedMinutes: 0,
        billableMinutes: 0,
      }),
    ).toBeNull();
  });

  it("names the gap between the hours and the invoice", () => {
    expect(
      describeNotChargeable({
        entryCount: 3,
        loggedMinutes: 360,
        billableMinutes: 300,
      }),
    ).toBe("1h not chargeable");
  });

  it("names the whole of it when none of it is chargeable", () => {
    expect(
      describeNotChargeable({
        entryCount: 1,
        loggedMinutes: 90,
        billableMinutes: 0,
      }),
    ).toBe("1h 30m not chargeable");
  });
});

describe("a rolled-up deliverable as the table draws it", () => {
  it("fills the four cells from the line", () => {
    expect(rollupRow(rolled())).toEqual({
      deliverableId: "dlv_a",
      title: "Homepage build",
      estimated: "4h",
      logged: "6h",
      notChargeable: null,
      against: "2h over · 150% of it",
    });
  });

  it("carries the id as the key, because two lines can share a title", () => {
    expect(rollupRow(rolled({ deliverableId: "dlv_b" })).deliverableId).toBe(
      "dlv_b",
    );
  });

  it("calls an unsized line what the scope list calls it", () => {
    const row = rollupRow(
      rolled({ estimatedMinutes: 0, varianceMinutes: null, loggedShare: null }),
    );
    expect(row.estimated).toBe("Not estimated");
    expect(row.against).toBe(NO_ESTIMATE_TO_COMPARE);
  });

  it("says nothing has been logged rather than showing a zero duration", () => {
    const row = rollupRow(
      rolled({
        entryCount: 0,
        loggedMinutes: 0,
        billableMinutes: 0,
        varianceMinutes: -240,
        loggedShare: 0,
      }),
    );
    expect(row.logged).toBe(NOTHING_LOGGED_LABEL);
    expect(row.against).toBe("4h left");
  });

  it("qualifies a row whose hours will not all be invoiced", () => {
    const row = rollupRow(rolled({ billableMinutes: 300 }));
    expect(row.logged).toBe("6h");
    expect(row.notChargeable).toBe("1h not chargeable");
  });

  it("reads a delivered line's unspent estimate as coming in under", () => {
    const row = rollupRow(
      rolled({
        delivered: true,
        loggedMinutes: 180,
        billableMinutes: 180,
        varianceMinutes: -60,
        loggedShare: 0.75,
      }),
    );
    expect(row.against).toBe("1h under · 75% of it");
  });
});

describe("what the project has logged, as a line of the panel", () => {
  it("shows the total and says how many entries built it", () => {
    expect(loggedFigure(project())).toEqual({
      label: "Logged",
      value: "7h 15m",
      note: "Across 3 entries.",
    });
  });

  it("agrees with the noun when there is only one entry", () => {
    const figure = loggedFigure(
      project({ entryCount: 1, loggedMinutes: 45, billableMinutes: 45 }),
    );
    expect(figure.note).toBe("Across 1 entry.");
  });

  it("adds the part that will not be invoiced", () => {
    const figure = loggedFigure(project({ billableMinutes: 375 }));
    expect(figure.note).toBe("Across 3 entries. 1h not chargeable.");
  });

  it("says plainly that nothing has been logged rather than counting nought", () => {
    const figure = loggedFigure(
      project({ entryCount: 0, loggedMinutes: 0, billableMinutes: 0 }),
    );
    expect(figure.value).toBe(NOTHING_LOGGED_LABEL);
    expect(figure.note).toBe("No time has been logged against this project yet.");
  });
});

describe("the estimate the hours are judged against", () => {
  const sized = [
    rolled({ deliverableId: "dlv_a", estimatedMinutes: 240 }),
    rolled({ deliverableId: "dlv_b", estimatedMinutes: 120 }),
  ];

  it("shows the scope list's total with no caveat when every line is sized", () => {
    expect(estimatedFigure(project({ lines: sized }))).toEqual({
      label: "Estimated",
      value: "6h",
      note: null,
    });
  });

  it("warns that the total does not cover the whole list", () => {
    const lines = [sized[0], rolled({ deliverableId: "dlv_b", estimatedMinutes: 0 })];
    const figure = estimatedFigure(
      project({ lines, estimatedMinutes: 240 }),
    );
    expect(figure.value).toBe("4h");
    expect(figure.note).toBe(
      "1 of 2 deliverables has no estimate, so this total does not cover the whole list.",
    );
  });

  it("says a wholly unsized list has nothing to total", () => {
    const lines = [rolled({ estimatedMinutes: 0 })];
    const figure = estimatedFigure(project({ lines, estimatedMinutes: 0 }));
    expect(figure.value).toBe("Not estimated");
    expect(figure.note).toBe(
      "No line on the list has an estimate on it, so there is nothing to total.",
    );
  });

  it("says a project with no scope list has nothing to set hours against", () => {
    // Not "no line has an estimate", which would send a reader looking for
    // lines to fill in when the list itself is what is missing.
    const figure = estimatedFigure(project({ lines: [], estimatedMinutes: 0 }));
    expect(figure.note).toBe(
      "No deliverables have been agreed, so there is nothing for these hours to be set against.",
    );
  });
});

describe("how the whole project stands against its scope list", () => {
  it("names the figure after the column it belongs with", () => {
    expect(againstEstimateFigure(project()).label).toBe(
      "Against the estimate",
    );
  });

  it("reads an overrun with the working written out", () => {
    const figure = againstEstimateFigure(project());
    expect(figure.value).toBe("1h 15m over · 121% of it");
    expect(figure.note).toBe("6h estimated, 7h 15m logged.");
  });

  it("reads unspent estimate as budget left, never as coming in under", () => {
    // A project is closed, not delivered. "Under" would be a judgement.
    const figure = againstEstimateFigure(
      project({
        loggedMinutes: 180,
        billableMinutes: 180,
        varianceMinutes: -180,
        loggedShare: 0.5,
      }),
    );
    expect(figure.value).toBe("3h left · 50% of it");
  });

  it("says what would turn the figure on when nothing is estimated", () => {
    const figure = againstEstimateFigure(
      project({ estimatedMinutes: 0, varianceMinutes: null, loggedShare: null }),
    );
    expect(figure.value).toBe(NO_ESTIMATE_TO_COMPARE);
    expect(figure.note).toBe(
      "Put an estimate on the deliverables and this figure starts saying whether the project is running over.",
    );
  });
});

describe("the hours that went against no line of scope", () => {
  function loose(entryCount: number, loggedMinutes: number) {
    return { entryCount, loggedMinutes, billableMinutes: loggedMinutes };
  }

  it("reassures a project whose every entry is attributed", () => {
    const figure = unattributedFigure(project());
    expect(figure.label).toBe("Against no deliverable");
    expect(figure.value).toBe(NOTHING_LOGGED_LABEL);
    expect(figure.note).toBe(
      "Every entry on this project is attributed to a line of the scope list.",
    );
  });

  it("says where loose time is counted and where it is not", () => {
    const figure = unattributedFigure(
      project({ unattributed: loose(2, 75) }),
    );
    expect(figure.value).toBe("1h 15m");
    expect(figure.note).toBe(
      "Across 2 entries. Counted in the total above and in none of the rows below — there is no line of scope for it to be set against.",
    );
  });

  it("flags a project whose time is mostly unattributed", () => {
    // Every row below then understates its line, and the figures would look
    // reassuring for the one reason a reader cannot see.
    const figure = unattributedFigure(
      project({ unattributed: loose(2, 300) }),
    );
    expect(figure.note).toContain("most of the time logged on this project");
  });

  it("does not flag loose time that is exactly half the total", () => {
    // Half is not more than half, and the clause is about the rows covering
    // the smaller part.
    const figure = unattributedFigure(
      project({ loggedMinutes: 400, unattributed: loose(2, 200) }),
    );
    expect(figure.note).not.toContain("most of the time logged");
  });

  it("has no opinion on a project with nothing logged at all", () => {
    const figure = unattributedFigure(
      project({ entryCount: 0, loggedMinutes: 0, billableMinutes: 0 }),
    );
    expect(figure.note).toBeNull();
  });
});

describe("the project's half of the rollup, in reading order", () => {
  it("runs fact, estimate, conclusion, qualification", () => {
    expect(rollupFigures(project()).map((figure) => figure.label)).toEqual([
      "Logged",
      "Estimated",
      "Against the estimate",
      "Against no deliverable",
    ]);
  });

  it("builds each row from the same rollup", () => {
    const figures = rollupFigures(project({ lines: [rolled()] }));
    expect(figures[0].value).toBe("7h 15m");
    expect(figures[1].value).toBe("6h");
    expect(figures[2].value).toBe("1h 15m over · 121% of it");
    expect(figures[3].value).toBe(NOTHING_LOGGED_LABEL);
  });
});

describe("why the rows might not add up to the total", () => {
  it("says nothing on the ordinary project, which is every project", () => {
    expect(describeUnmatchedTime(project())).toBeNull();
  });

  it("names the minutes that are in the total and in no row", () => {
    const note = describeUnmatchedTime(project({ unmatchedMinutes: 25 }));
    expect(note).toContain("25m");
    expect(note).toContain("in none of the rows below");
  });

  it("tells the reader the move that fixes it", () => {
    expect(describeUnmatchedTime(project({ unmatchedMinutes: 25 }))).toContain(
      "reloading",
    );
  });
});

describe("the line above the rollup table", () => {
  const over = rolled({ deliverableId: "dlv_a", varianceMinutes: 120 });
  const under = rolled({
    deliverableId: "dlv_b",
    loggedMinutes: 60,
    billableMinutes: 60,
    varianceMinutes: -180,
    loggedShare: 0.25,
  });
  const untouched = rolled({
    deliverableId: "dlv_c",
    loggedMinutes: 0,
    billableMinutes: 0,
    entryCount: 0,
    varianceMinutes: -240,
    loggedShare: 0,
  });

  it("says when the one line has no time against it", () => {
    expect(describeRollupTable(project({ lines: [untouched] }))).toBe(
      "1 deliverable, with no time logged against it yet.",
    );
  });

  it("says when none of several lines has any time against it", () => {
    const second = rolled({ ...untouched, deliverableId: "dlv_d" });
    expect(
      describeRollupTable(project({ lines: [untouched, second] })),
    ).toBe("2 deliverables, with no time logged against any of them yet.");
  });

  it("counts the lines with time and says none has run over", () => {
    expect(describeRollupTable(project({ lines: [under, untouched] }))).toBe(
      "2 deliverables, 1 of them with time logged. None has gone past its estimate.",
    );
  });

  it("names a single overrun in the singular", () => {
    expect(describeRollupTable(project({ lines: [over, under] }))).toBe(
      "2 deliverables, 2 of them with time logged. One has gone past its estimate.",
    );
  });

  it("counts several overruns", () => {
    const another = rolled({ deliverableId: "dlv_d", varianceMinutes: 30 });
    expect(
      describeRollupTable(project({ lines: [over, another, under] })),
    ).toBe(
      "3 deliverables, 3 of them with time logged. 2 have gone past their estimates.",
    );
  });

  it("speaks of a lone line as itself", () => {
    expect(describeRollupTable(project({ lines: [over] }))).toBe(
      "1 deliverable, with time logged against it. It has gone past its estimate.",
    );
  });

  it("does not count an unsized line as having run over", () => {
    // It has no estimate to be past, however many hours went into it.
    const unsized = rolled({
      deliverableId: "dlv_e",
      estimatedMinutes: 0,
      varianceMinutes: null,
      loggedShare: null,
    });
    expect(describeRollupTable(project({ lines: [unsized] }))).toBe(
      "1 deliverable, with time logged against it. It has not gone past its estimate.",
    );
  });
});

describe("what is wrong with a rollup, if anything", () => {
  const bad = rolled({ deliverableId: "dlv_x", estimatedMinutes: -120 });

  it("has nothing to say about the ordinary project", () => {
    expect(describeNegativeEstimates(project({ lines: [rolled()] }))).toBeNull();
    expect(rollupProblems(project({ lines: [rolled()] }))).toEqual([]);
  });

  it("names a single negative estimate in the singular", () => {
    const note = describeNegativeEstimates(project({ lines: [bad] }));
    expect(note).toContain("One deliverable has a negative estimate");
  });

  it("counts several of them", () => {
    const other = rolled({ deliverableId: "dlv_y", estimatedMinutes: -30 });
    expect(describeNegativeEstimates(project({ lines: [bad, other] }))).toContain(
      "2 deliverables have a negative estimate",
    );
  });

  it("finds a negative line whose estimate another line cancels out", () => {
    // Plus two hours and minus two hours leave the project reading nought,
    // and the figures alone would call a sized project unestimated.
    const cancels = rolled({ deliverableId: "dlv_z", estimatedMinutes: 120 });
    expect(
      describeNegativeEstimates(
        project({ lines: [bad, cancels], estimatedMinutes: 0 }),
      ),
    ).not.toBeNull();
  });

  it("puts the false cells before the column that will not add up", () => {
    const problems = rollupProblems(
      project({ lines: [bad], unmatchedMinutes: 25 }),
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("negative estimate");
    expect(problems[1]).toContain("25m");
  });
});
