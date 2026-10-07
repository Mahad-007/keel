import { describe, expect, it } from "vitest";

import {
  describeEstimate,
  UNESTIMATED_LABEL,
} from "@/lib/deliverables/list";
import {
  DELIVERABLE_STATUSES,
  type DeliverableStatus,
} from "@/lib/deliverables/status";

import {
  deliveredEstimatedMinutes,
  isDelivered,
  remainingEstimatedMinutes,
  totalEstimatedMinutes,
  unestimatedCount,
  type ScopeLine,
} from "./scope";

/**
 * A scope line, written as the two things these functions read. Everything
 * here is whole minutes and whole cents, and the degenerate rows — zero,
 * negative, a status the list does not know — get the same attention as the
 * ordinary ones, because the column they come out of permits all of them.
 */
function line(
  estimatedMinutes: number,
  status: DeliverableStatus = "pending",
): ScopeLine {
  return { estimatedMinutes, status };
}

describe("totalEstimatedMinutes", () => {
  it("adds up the estimates on the list", () => {
    expect(totalEstimatedMinutes([line(90), line(30), line(480)])).toBe(600);
  });

  it("totals a single line as itself", () => {
    expect(totalEstimatedMinutes([line(45)])).toBe(45);
  });

  it("totals an empty scope list as nothing", () => {
    expect(totalEstimatedMinutes([])).toBe(0);
  });

  it("adds a zero as a zero rather than skipping an unsized line", () => {
    expect(totalEstimatedMinutes([line(0), line(60), line(0)])).toBe(60);
  });

  it("totals a list nobody has estimated at all as nothing", () => {
    expect(totalEstimatedMinutes([line(0), line(0)])).toBe(0);
  });

  it("carries a negative row into the total instead of clamping it", () => {
    expect(totalEstimatedMinutes([line(120), line(-30)])).toBe(90);
  });

  it("reports a total below zero when the rows add up that way", () => {
    expect(totalEstimatedMinutes([line(-30), line(-60)])).toBe(-90);
  });
});

describe("unestimatedCount", () => {
  it("counts the lines sitting at zero", () => {
    expect(unestimatedCount([line(0), line(60), line(0)])).toBe(2);
  });

  it("counts nothing when every line has been sized", () => {
    expect(unestimatedCount([line(60), line(90)])).toBe(0);
  });

  it("counts every line of a list nobody has estimated", () => {
    expect(unestimatedCount([line(0), line(0), line(0)])).toBe(3);
  });

  it("counts nothing on an empty scope list", () => {
    expect(unestimatedCount([])).toBe(0);
  });

  it("treats a negative row as estimated, badly, rather than missing", () => {
    expect(unestimatedCount([line(-30)])).toBe(0);
  });

  it("agrees with the words the scope list puts on each line", () => {
    for (const minutes of [0, 1, 90, -30]) {
      expect(unestimatedCount([line(minutes)])).toBe(
        describeEstimate(minutes) === UNESTIMATED_LABEL ? 1 : 0,
      );
    }
  });
});

describe("isDelivered", () => {
  it("counts a line marked done as delivered", () => {
    expect(isDelivered(line(60, "done"))).toBe(true);
  });

  it("counts a line nobody has touched as still to do", () => {
    expect(isDelivered(line(60, "pending"))).toBe(false);
  });

  it("counts a line in progress as still to do, not half delivered", () => {
    expect(isDelivered(line(60, "started"))).toBe(false);
  });

  it("covers every status the list knows", () => {
    expect(
      DELIVERABLE_STATUSES.map((status) => isDelivered(line(60, status))),
    ).toEqual([false, false, true]);
  });

  it("keeps a status it cannot read in the work still to do", () => {
    const hand = {
      estimatedMinutes: 60,
      status: "shipped",
    } as unknown as ScopeLine;
    expect(isDelivered(hand)).toBe(false);
  });

  it("does not care what a delivered line was estimated at", () => {
    expect(isDelivered(line(0, "done"))).toBe(true);
    expect(isDelivered(line(-30, "done"))).toBe(true);
  });
});

describe("remainingEstimatedMinutes", () => {
  it("leaves out the lines already delivered", () => {
    expect(
      remainingEstimatedMinutes([
        line(120, "done"),
        line(60, "pending"),
        line(30, "pending"),
      ]),
    ).toBe(90);
  });

  it("keeps a line in progress in the total at its full estimate", () => {
    expect(
      remainingEstimatedMinutes([line(120, "started"), line(60, "pending")]),
    ).toBe(180);
  });

  it("does not move when a pending line is merely started", () => {
    const before = remainingEstimatedMinutes([line(120, "pending")]);
    expect(remainingEstimatedMinutes([line(120, "started")])).toBe(before);
  });

  it("is the whole total when nothing has been delivered", () => {
    const lines = [line(120, "pending"), line(60, "started")];
    expect(remainingEstimatedMinutes(lines)).toBe(totalEstimatedMinutes(lines));
  });

  it("is nothing when every line is done", () => {
    expect(
      remainingEstimatedMinutes([line(120, "done"), line(60, "done")]),
    ).toBe(0);
  });

  it("is nothing on an empty scope list", () => {
    expect(remainingEstimatedMinutes([])).toBe(0);
  });

  it("leaves an unsized line in the list without adding to the total", () => {
    expect(
      remainingEstimatedMinutes([line(0, "pending"), line(60, "pending")]),
    ).toBe(60);
  });

  it("carries a negative row into what is left rather than dropping it", () => {
    expect(
      remainingEstimatedMinutes([line(-30, "pending"), line(90, "pending")]),
    ).toBe(60);
  });
});

describe("deliveredEstimatedMinutes", () => {
  it("adds up only the lines marked done", () => {
    expect(
      deliveredEstimatedMinutes([
        line(120, "done"),
        line(60, "started"),
        line(30, "pending"),
      ]),
    ).toBe(120);
  });

  it("is nothing while no line is done", () => {
    expect(
      deliveredEstimatedMinutes([line(120, "started"), line(60, "pending")]),
    ).toBe(0);
  });

  it("is nothing on an empty scope list", () => {
    expect(deliveredEstimatedMinutes([])).toBe(0);
  });

  it("counts a delivered line nobody sized as nothing delivered", () => {
    expect(
      deliveredEstimatedMinutes([line(0, "done"), line(90, "done")]),
    ).toBe(90);
  });
});

describe("the three estimate totals together", () => {
  const lists: ScopeLine[][] = [
    [],
    [line(90, "pending")],
    [line(90, "done")],
    [line(120, "done"), line(60, "started"), line(30, "pending")],
    [line(0, "pending"), line(0, "done")],
    [line(-30, "pending"), line(90, "done")],
    [line(-30, "done"), line(-60, "started")],
  ];

  it("splits every list into delivered and remaining with nothing lost", () => {
    for (const lines of lists) {
      expect(
        deliveredEstimatedMinutes(lines) + remainingEstimatedMinutes(lines),
      ).toBe(totalEstimatedMinutes(lines));
    }
  });

  it("puts each line on exactly one side of the split", () => {
    for (const lines of lists) {
      const delivered = lines.filter(isDelivered).length;
      expect(lines.length - delivered).toBe(
        lines.filter((candidate) => !isDelivered(candidate)).length,
      );
    }
  });
});
