import { describe, expect, it } from "vitest";

import {
  describeLog,
  EMPTY_LOG,
  summarizeLog,
  type LoggedWork,
} from "./log";

function work(
  partial: Partial<LoggedWork> & Pick<LoggedWork, "minutes">,
): LoggedWork {
  return {
    workedOn: "2026-10-16",
    projectId: "prj_abc",
    billable: true,
    ...partial,
  };
}

describe("summarizeLog", () => {
  it("comes to nothing for an empty log", () => {
    expect(summarizeLog([])).toEqual(EMPTY_LOG);
  });

  it("counts the rows and adds up the minutes", () => {
    const summary = summarizeLog([work({ minutes: 90 }), work({ minutes: 30 })]);

    expect(summary.entries).toBe(2);
    expect(summary.minutes).toBe(120);
  });

  it("leaves time that is not chargeable out of the billable figure", () => {
    const summary = summarizeLog([
      work({ minutes: 90 }),
      work({ minutes: 30, billable: false }),
    ]);

    expect(summary.minutes).toBe(120);
    expect(summary.billableMinutes).toBe(90);
  });

  it("counts a day once however many entries it holds", () => {
    const summary = summarizeLog([
      work({ minutes: 60, workedOn: "2026-10-16" }),
      work({ minutes: 60, workedOn: "2026-10-16" }),
      work({ minutes: 60, workedOn: "2026-10-17" }),
    ]);

    expect(summary.entries).toBe(3);
    expect(summary.days).toBe(2);
  });

  it("counts a project once however many entries it holds", () => {
    const summary = summarizeLog([
      work({ minutes: 60, projectId: "prj_one" }),
      work({ minutes: 60, projectId: "prj_two" }),
      work({ minutes: 60, projectId: "prj_two" }),
    ]);

    expect(summary.projects).toBe(2);
  });

  it("adds up in whole minutes, with no rounding anywhere", () => {
    const summary = summarizeLog(
      Array.from({ length: 40 }, () => work({ minutes: 20 })),
    );

    expect(summary.minutes).toBe(800);
  });
});

describe("describeLog", () => {
  it("says there is nothing when the log is empty", () => {
    expect(describeLog(EMPTY_LOG)).toBe("Nothing logged.");
  });

  it("counts one of everything in the singular", () => {
    expect(describeLog(summarizeLog([work({ minutes: 90 })]))).toBe(
      "One entry, 1h 30m on one day for one project.",
    );
  });

  it("spells out the spread of a wider log", () => {
    const summary = summarizeLog([
      work({ minutes: 90, workedOn: "2026-10-16", projectId: "prj_one" }),
      work({ minutes: 60, workedOn: "2026-10-17", projectId: "prj_two" }),
      work({ minutes: 30, workedOn: "2026-10-18", projectId: "prj_two" }),
    ]);

    expect(describeLog(summary)).toBe(
      "3 entries, 3h over 3 days across 2 projects.",
    );
  });

  it("says nothing about chargeability when all of it is chargeable", () => {
    expect(describeLog(summarizeLog([work({ minutes: 60 })]))).not.toMatch(
      /chargeable/,
    );
  });

  it("names the gap between the total and the invoice", () => {
    const summary = summarizeLog([
      work({ minutes: 90 }),
      work({ minutes: 30, billable: false }),
    ]);

    expect(describeLog(summary)).toBe(
      "2 entries, 2h on one day for one project, 30m of it not chargeable.",
    );
  });

  it("says a log with nothing chargeable in it is all of it", () => {
    const summary = summarizeLog([work({ minutes: 45, billable: false })]);

    expect(describeLog(summary)).toBe(
      "One entry, 45m on one day for one project, 45m of it not chargeable.",
    );
  });
});
