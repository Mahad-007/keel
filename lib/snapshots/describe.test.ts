import { describe, expect, it } from "vitest";

import {
  describeEstimateMovement,
  describeFieldChange,
  describeLineChanges,
  SCOPE_CHANGE_LABELS,
} from "./describe";
import {
  SCOPE_CHANGE_KINDS,
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
});
