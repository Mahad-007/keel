import { describe, expect, it } from "vitest";

import {
  describeContractMovement,
  describeDiffEstimateProblem,
  describeDiffEntry,
  describeUnchangedLines,
  diffEntryEstimate,
  diffEntryTitle,
  describeScopeDiff,
  SCOPE_UNCHANGED_SINCE,
  describeEstimateMovement,
  describeFieldChange,
  describeLineChanges,
  SCOPE_CHANGE_LABELS,
} from "./describe";
import {
  SCOPE_CHANGE_KINDS,
  scopeDiffEntries,
  summariseScopeDiff,
  type ScopeDiffSummary,
} from "./diff";

/** A summary with nothing in it, for a test to move one figure of. */
function summary(over: Partial<ScopeDiffSummary> = {}): ScopeDiffSummary {
  return { ...summariseScopeDiff([], 0, 0), ...over };
}

describe("SCOPE_CHANGE_LABELS", () => {
  it("has a word for every kind a comparison can report", () => {
    for (const kind of SCOPE_CHANGE_KINDS) {
      expect(SCOPE_CHANGE_LABELS[kind]).not.toBe("");
    }
  });
});

describe("describeFieldChange", () => {
  it("names both titles of a retitled line", () => {
    expect(
      describeFieldChange({
        field: "title",
        before: "Discovery",
        after: "Discovery phase",
      }),
    ).toBe("Retitled from “Discovery” to “Discovery phase”.");
  });

  it("reads an estimate that went up", () => {
    expect(
      describeFieldChange({ field: "estimate", before: 480, after: 960 }),
    ).toBe("Estimate up from 8h to 16h.");
  });

  it("reads an estimate that came down", () => {
    expect(
      describeFieldChange({ field: "estimate", before: 960, after: 480 }),
    ).toBe("Estimate down from 16h to 8h.");
  });

  it("reads a line that was finally sized rather than one that grew", () => {
    // A zero is a missing number, not an estimate of nothing.
    expect(
      describeFieldChange({ field: "estimate", before: 0, after: 120 }),
    ).toBe("Estimated at 2h, having had no estimate before.");
  });

  it("reads a line that lost its estimate rather than one that shrank", () => {
    expect(
      describeFieldChange({ field: "estimate", before: 120, after: 0 }),
    ).toBe("Estimate of 2h taken off, leaving the line unsized.");
  });

  it("reads a status move in the words the list uses", () => {
    expect(
      describeFieldChange({ field: "status", before: "pending", after: "done" }),
    ).toBe("Status moved from Not started to Done.");
  });

  it("reads a status the app does not recognise as whatever is stored", () => {
    expect(
      describeFieldChange({
        field: "status",
        before: "blocked",
        after: "started",
      }),
    ).toBe("Status moved from blocked to In progress.");
  });

  it("says detail was added without quoting the paragraph", () => {
    expect(
      describeFieldChange({
        field: "description",
        before: null,
        after: "Two workshops.",
      }),
    ).toBe("Detail added.");
  });

  it("says detail was taken off", () => {
    expect(
      describeFieldChange({
        field: "description",
        before: "Two workshops.",
        after: null,
      }),
    ).toBe("Detail taken off.");
  });

  it("says detail was reworded when both sides have words", () => {
    expect(
      describeFieldChange({
        field: "description",
        before: "Two workshops.",
        after: "Three workshops.",
      }),
    ).toBe("Detail reworded.");
  });

  it("reads a hand-edited negative estimate rather than refusing to", () => {
    expect(
      describeFieldChange({ field: "estimate", before: 480, after: -60 }),
    ).toBe("Estimate down from 8h to -1h.");
  });
});

describe("describeLineChanges", () => {
  it("says nothing when no line was added, dropped or changed", () => {
    expect(describeLineChanges(summary({ unchangedCount: 4 }))).toBeNull();
  });

  it("puts the noun on the one count there is", () => {
    expect(describeLineChanges(summary({ addedCount: 2 }))).toBe(
      "2 deliverables added",
    );
  });

  it("agrees the noun with a count of one", () => {
    expect(describeLineChanges(summary({ removedCount: 1 }))).toBe(
      "1 deliverable dropped",
    );
  });

  it("puts the noun on the first count only", () => {
    expect(
      describeLineChanges(
        summary({ addedCount: 2, removedCount: 1, changedCount: 3 }),
      ),
    ).toBe("2 deliverables added, 1 dropped and 3 changed");
  });

  it("joins two clauses with an and rather than a comma", () => {
    expect(
      describeLineChanges(summary({ addedCount: 1, changedCount: 2 })),
    ).toBe("1 deliverable added and 2 changed");
  });

  it("leaves the untouched lines out of the clause", () => {
    expect(
      describeLineChanges(summary({ addedCount: 1, unchangedCount: 9 })),
    ).toBe("1 deliverable added");
  });
});

describe("describeEstimateMovement", () => {
  it("says the estimate is unchanged, with the figure it stands at", () => {
    expect(
      describeEstimateMovement(
        summary({ estimatedMinutesBefore: 2_400, estimatedMinutesAfter: 2_400 }),
      ),
    ).toBe("The estimate is unchanged, at 40 hours.");
  });

  it("reports a rise with both ends of it", () => {
    expect(
      describeEstimateMovement(
        summary({
          estimatedMinutesBefore: 2_400,
          estimatedMinutesAfter: 2_760,
          estimatedMinutesDelta: 360,
          estimatedHoursDelta: 6,
        }),
      ),
    ).toBe("The estimate is up 6 hours, from 40 hours to 46 hours.");
  });

  it("reports a fall as a positive number in the other direction", () => {
    expect(
      describeEstimateMovement(
        summary({
          estimatedMinutesBefore: 2_400,
          estimatedMinutesAfter: 2_040,
          estimatedMinutesDelta: -360,
          estimatedHoursDelta: -6,
        }),
      ),
    ).toBe("The estimate is down 6 hours, from 40 hours to 34 hours.");
  });

  it("says a list nobody had sized has been sized", () => {
    // Not "up 8 hours from 0 hours": a zero is a number nobody supplied.
    expect(
      describeEstimateMovement(
        summary({
          estimatedMinutesBefore: 0,
          estimatedMinutesAfter: 480,
          estimatedMinutesDelta: 480,
          estimatedHoursDelta: 8,
        }),
      ),
    ).toBe(
      "Nothing was estimated when the snapshot was taken; the scope list now comes to 8 hours.",
    );
  });

  it("says an estimate went missing rather than shrank to nothing", () => {
    expect(
      describeEstimateMovement(
        summary({
          estimatedMinutesBefore: 480,
          estimatedMinutesAfter: 0,
          estimatedMinutesDelta: -480,
          estimatedHoursDelta: -8,
        }),
      ),
    ).toBe("Nothing is estimated now, where the snapshot came to 8 hours.");
  });

  it("says nothing is estimated rather than claiming a steady zero", () => {
    // A delta of zero between two zeroes is a list nobody has sized, not an
    // estimate that held.
    expect(
      describeEstimateMovement(
        summary({ estimatedMinutesBefore: 0, estimatedMinutesAfter: 0 }),
      ),
    ).toBe(
      "Nothing was estimated when the snapshot was taken, and nothing is estimated now.",
    );
  });

  it("agrees the noun with a movement of exactly one hour", () => {
    expect(
      describeEstimateMovement(
        summary({
          estimatedMinutesBefore: 120,
          estimatedMinutesAfter: 180,
          estimatedMinutesDelta: 60,
          estimatedHoursDelta: 1,
        }),
      ),
    ).toBe("The estimate is up 1 hour, from 2 hours to 3 hours.");
  });

  /*
    Through `summariseScopeDiff` rather than a hand-written summary, because
    what is under test is that the three figures in one sentence came from the
    same arithmetic: a reader who subtracts the two ends has to land on the
    number between them. Rounding the seven minutes of movement on its own
    would print 0.12 here and leave the sentence contradicting itself.
  */
  it("quotes a movement the two ends it prints add up to", () => {
    const entries = scopeDiffEntries(
      [{ ...SNAPSHOT_LINE, estimatedMinutes: 7 }],
      [{ ...LIVE_LINE, estimatedMinutes: 14 }],
    );

    expect(describeEstimateMovement(summariseScopeDiff(entries, 0, 0))).toBe(
      "The estimate is up 0.11 hours, from 0.12 hours to 0.23 hours.",
    );
  });
});

describe("describeEstimateMovement with a negative line on a side", () => {
  it("does not call a cancelled snapshot total an unestimated list", () => {
    // Minus two hours against plus two: every line is sized and the total is
    // nought. Saying nothing was estimated would be false about both sides.
    const sentence = describeEstimateMovement(
      summary({
        estimatedMinutesBefore: 0,
        estimatedMinutesAfter: 0,
        negativeEstimateCountBefore: 1,
        negativeEstimateCountAfter: 1,
      }),
    );

    expect(sentence).not.toContain("Nothing was estimated");
    expect(sentence).toBe("The estimate is unchanged, at 0 hours.");
  });

  it("reads the movement off a cancelled snapshot as plain arithmetic", () => {
    expect(
      describeEstimateMovement(
        summary({
          estimatedMinutesBefore: 0,
          estimatedMinutesAfter: 480,
          estimatedMinutesDelta: 480,
          estimatedHoursDelta: 8,
          negativeEstimateCountBefore: 1,
        }),
      ),
    ).toBe("The estimate is up 8 hours, from 0 hours to 8 hours.");
  });

  it("does not say nothing is estimated now when the total cancels out", () => {
    expect(
      describeEstimateMovement(
        summary({
          estimatedMinutesBefore: 480,
          estimatedMinutesAfter: 0,
          estimatedMinutesDelta: -480,
          estimatedHoursDelta: -8,
          negativeEstimateCountAfter: 2,
        }),
      ),
    ).toBe("The estimate is down 8 hours, from 8 hours to 0 hours.");
  });

  it("still reads an unsized side as unsized when the bad line is the other", () => {
    // The guard is per side: a snapshot nobody had estimated reads the same
    // whether or not the list since has a hand-edited row in it.
    expect(
      describeEstimateMovement(
        summary({
          estimatedMinutesBefore: 0,
          estimatedMinutesAfter: 420,
          estimatedMinutesDelta: 420,
          estimatedHoursDelta: 7,
          negativeEstimateCountAfter: 1,
        }),
      ),
    ).toBe(
      "Nothing was estimated when the snapshot was taken; the scope list now comes to 7 hours.",
    );
  });
});

describe("describeDiffEstimateProblem", () => {
  it("says nothing about a comparison of estimates somebody could have typed", () => {
    expect(describeDiffEstimateProblem(summary())).toBe(null);
  });

  it("names the scope list when the bad row is on it now", () => {
    const sentence = describeDiffEstimateProblem(
      summary({ negativeEstimateCountAfter: 1 }),
    );

    expect(sentence).toContain("the scope list now holds 1 deliverable");
    expect(sentence).not.toContain("this snapshot holds");
  });

  it("names the snapshot when the bad row was captured and has since gone", () => {
    const sentence = describeDiffEstimateProblem(
      summary({ negativeEstimateCountBefore: 2 }),
    );

    expect(sentence).toContain("this snapshot holds 2 deliverables");
    expect(sentence).not.toContain("the scope list now holds");
  });

  it("reports both sides separately rather than adding the counts up", () => {
    // One bad row and two is not three bad rows: a reader sent looking for
    // three would find two, on a list that holds one.
    const sentence = describeDiffEstimateProblem(
      summary({
        negativeEstimateCountBefore: 2,
        negativeEstimateCountAfter: 1,
      }),
    );

    expect(sentence).toContain(
      "the scope list now holds 1 deliverable with a negative estimate, and this snapshot holds 2",
    );
    expect(sentence).not.toContain("3 deliverables");
  });

  it("says the row was not written through the form, which refuses one", () => {
    const sentence = describeDiffEstimateProblem(
      summary({ negativeEstimateCountAfter: 1 }),
    );

    expect(sentence).toContain("straight to the database");
  });
});

describe("describeContractMovement", () => {
  it("says the price is unchanged, which is the point of recording it", () => {
    expect(
      describeContractMovement(
        summary({
          contractValueCentsBefore: 500_000,
          contractValueCentsAfter: 500_000,
        }),
      ),
    ).toBe("The contract value is unchanged, at $5,000.00.");
  });

  it("reports a rise and where it landed", () => {
    expect(
      describeContractMovement(
        summary({
          contractValueCentsBefore: 500_000,
          contractValueCentsAfter: 650_000,
          contractValueCentsDelta: 150_000,
        }),
      ),
    ).toBe("The contract value is up $1,500.00, to $6,500.00.");
  });

  it("reports a fall as a positive amount in the other direction", () => {
    expect(
      describeContractMovement(
        summary({
          contractValueCentsBefore: 650_000,
          contractValueCentsAfter: 500_000,
          contractValueCentsDelta: -150_000,
        }),
      ),
    ).toBe("The contract value is down $1,500.00, to $5,000.00.");
  });
});

describe("describeScopeDiff", () => {
  it("says so plainly when nothing has changed", () => {
    expect(describeScopeDiff(summary())).toBe(SCOPE_UNCHANGED_SINCE);
  });

  it("reads the lines, the estimate and the price in that order", () => {
    expect(
      describeScopeDiff(
        summary({
          addedCount: 2,
          changedCount: 1,
          estimatedMinutesBefore: 2_400,
          estimatedMinutesAfter: 2_760,
          estimatedMinutesDelta: 360,
          estimatedHoursDelta: 6,
          contractValueCentsBefore: 500_000,
          contractValueCentsAfter: 500_000,
          hasChanges: true,
        }),
      ),
    ).toBe(
      "Since this snapshot: 2 deliverables added and 1 changed. " +
        "The estimate is up 6 hours, from 40 hours to 46 hours. " +
        "The contract value is unchanged, at $5,000.00.",
    );
  });

  it("leaves the lines clause out when only the price moved", () => {
    expect(
      describeScopeDiff(
        summary({
          unchangedCount: 3,
          estimatedMinutesBefore: 2_400,
          estimatedMinutesAfter: 2_400,
          contractValueCentsBefore: 650_000,
          contractValueCentsAfter: 500_000,
          contractValueCentsDelta: -150_000,
          hasChanges: true,
        }),
      ),
    ).toBe(
      "The estimate is unchanged, at 40 hours. " +
        "The contract value is down $1,500.00, to $5,000.00.",
    );
  });

  it("says the price held when the scope grew, which is the point", () => {
    const sentence = describeScopeDiff(
      summary({
        addedCount: 1,
        estimatedMinutesBefore: 2_400,
        estimatedMinutesAfter: 2_880,
        estimatedMinutesDelta: 480,
        estimatedHoursDelta: 8,
        contractValueCentsBefore: 500_000,
        contractValueCentsAfter: 500_000,
        hasChanges: true,
      }),
    );

    expect(sentence).toContain("1 deliverable added");
    expect(sentence).toContain("The contract value is unchanged");
  });
});

describe("describeUnchangedLines", () => {
  it("says nothing when every line moved", () => {
    expect(describeUnchangedLines(summary({ addedCount: 2 }))).toBeNull();
  });

  it("agrees the noun with a single untouched line", () => {
    expect(describeUnchangedLines(summary({ unchangedCount: 1 }))).toBe(
      "One other deliverable is exactly as it was agreed, and is not listed.",
    );
  });

  it("counts the lines the table leaves out", () => {
    expect(describeUnchangedLines(summary({ unchangedCount: 9 }))).toBe(
      "9 other deliverables are exactly as they were agreed, and are not listed.",
    );
  });
});

/** The one entry a comparison of these two lists produces. */
function entry(
  before: Parameters<typeof scopeDiffEntries>[0],
  after: Parameters<typeof scopeDiffEntries>[1],
) {
  return scopeDiffEntries(before, after)[0];
}

const SNAPSHOT_LINE = {
  deliverableId: "dlv_1",
  title: "Discovery",
  description: null,
  estimatedMinutes: 480,
  status: "pending" as const,
};

const LIVE_LINE = {
  id: "dlv_1",
  title: "Discovery",
  description: null,
  estimatedMinutes: 480,
  status: "pending" as const,
};

describe("diffEntryTitle", () => {
  it("names a changed line by what it is called now", () => {
    expect(
      diffEntryTitle(
        entry([SNAPSHOT_LINE], [{ ...LIVE_LINE, title: "Discovery phase" }]),
      ),
    ).toBe("Discovery phase");
  });

  it("names a dropped line by the title the snapshot kept", () => {
    expect(diffEntryTitle(entry([SNAPSHOT_LINE], []))).toBe("Discovery");
  });

  it("names an added line by the title it has", () => {
    expect(diffEntryTitle(entry([], [LIVE_LINE]))).toBe("Discovery");
  });
});

describe("diffEntryEstimate", () => {
  it("shows where a changed line's estimate is now", () => {
    expect(
      diffEntryEstimate(
        entry([SNAPSHOT_LINE], [{ ...LIVE_LINE, estimatedMinutes: 960 }]),
      ),
    ).toBe("16h");
  });

  it("shows the estimate a dropped line took with it", () => {
    expect(diffEntryEstimate(entry([SNAPSHOT_LINE], []))).toBe("8h");
  });

  it("says an unsized line is unsized rather than showing a zero", () => {
    expect(
      diffEntryEstimate(entry([], [{ ...LIVE_LINE, estimatedMinutes: 0 }])),
    ).toBe("Not estimated");
  });
});

describe("describeDiffEntry", () => {
  it("says an added line was agreed after the snapshot", () => {
    expect(describeDiffEntry(entry([], [LIVE_LINE]))).toEqual([
      "Not in this snapshot — agreed after it was taken.",
    ]);
  });

  it("says a dropped line is no longer owed", () => {
    expect(describeDiffEntry(entry([SNAPSHOT_LINE], []))).toEqual([
      "No longer in the scope list.",
    ]);
  });

  it("lists every change to a line that moved", () => {
    expect(
      describeDiffEntry(
        entry(
          [SNAPSHOT_LINE],
          [
            {
              ...LIVE_LINE,
              title: "Discovery phase",
              estimatedMinutes: 960,
            },
          ],
        ),
      ),
    ).toEqual([
      "Retitled from “Discovery” to “Discovery phase”.",
      "Estimate up from 8h to 16h.",
    ]);
  });

  it("has nothing to say about a line that did not move", () => {
    expect(describeDiffEntry(entry([SNAPSHOT_LINE], [LIVE_LINE]))).toEqual([]);
  });
});
