import { describe, expect, it } from "vitest";

import {
  describeEstimate,
  UNESTIMATED_LABEL,
} from "@/lib/deliverables/list";
import {
  DELIVERABLE_STATUSES,
  type DeliverableStatus,
} from "@/lib/deliverables/status";
import { costOfMinutes, formatCents } from "@/lib/money";

import {
  deliveredCount,
  deliveredEstimatedMinutes,
  deliveredShare,
  estimatedHours,
  impliedRateCents,
  isDelivered,
  remainingEstimatedMinutes,
  summariseScope,
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

describe("estimatedHours", () => {
  it("turns a whole number of hours into itself", () => {
    expect(estimatedHours(60)).toBe(1);
    expect(estimatedHours(2400)).toBe(40);
  });

  it("writes a part hour as a decimal", () => {
    expect(estimatedHours(90)).toBe(1.5);
    expect(estimatedHours(15)).toBe(0.25);
  });

  it("rounds a third of an hour to hundredths rather than trailing off", () => {
    expect(estimatedHours(20)).toBe(0.33);
    expect(estimatedHours(100)).toBe(1.67);
  });

  it("keeps a total that does not divide evenly readable", () => {
    expect(estimatedHours(101)).toBe(1.68);
  });

  it("says nothing is nothing", () => {
    expect(estimatedHours(0)).toBe(0);
  });

  it("keeps the sign of an estimate below zero", () => {
    expect(estimatedHours(-90)).toBe(-1.5);
    expect(estimatedHours(-20)).toBe(-0.33);
  });

  it("rounds a single minute to a hundredth rather than to zero", () => {
    expect(estimatedHours(1)).toBe(0.02);
  });

  it("does not hand the page a negative zero to render", () => {
    expect(Object.is(estimatedHours(-0.2), 0)).toBe(true);
    expect(Object.is(estimatedHours(-0), 0)).toBe(true);
  });
});

describe("impliedRateCents", () => {
  it("divides the contract by the hours the estimate comes to", () => {
    // $4,000 against 40 hours is $100/hr.
    expect(impliedRateCents(400_000, 2400)).toBe(10_000);
  });

  it("works out the rate on an estimate of part of an hour", () => {
    // $50 for half an hour is $100/hr.
    expect(impliedRateCents(5_000, 30)).toBe(10_000);
  });

  it("shows the rate a generous estimate has quietly agreed to", () => {
    // The same $4,000, estimated at 80 hours instead: half the rate.
    expect(impliedRateCents(400_000, 4800)).toBe(5_000);
  });

  it("rounds to the nearest cent rather than a shade under", () => {
    // $100 over seven hours is $14.2857…/hr.
    expect(impliedRateCents(10_000, 420)).toBe(1_429);
  });

  it("reports a rate of nothing for work agreed at no charge", () => {
    expect(impliedRateCents(0, 2400)).toBe(0);
  });
});

describe("impliedRateCents against costOfMinutes", () => {
  /**
   * The two are inverses, and it matters that they stay inverses: Phase 4
   * values burned time with `costOfMinutes` and compares it against a contract
   * this function reads a rate out of. If they drift, a project exactly on
   * budget reads as over it.
   *
   * Exactly inverse when the estimate is a whole number of hours, which is
   * what the estimate field asks for and what these cases use.
   */
  const RATES = [10_000, 12_500, 7_550, 1, 0];
  const WHOLE_HOURS = [60, 120, 2400];

  it("recovers the rate a whole-hour contract was priced at", () => {
    for (const rateCents of RATES) {
      for (const minutes of WHOLE_HOURS) {
        const contract = costOfMinutes(minutes, rateCents);
        expect(impliedRateCents(contract, minutes)).toBe(rateCents);
      }
    }
  });

  it("prices a contract that divides evenly by its hours back out", () => {
    for (const contract of [400_000, 123_480, 400, 0]) {
      const rate = impliedRateCents(contract, 2400);
      expect(rate).not.toBeNull();
      expect(costOfMinutes(2400, rate as number)).toBe(contract);
    }
  });

  it("loses no more than the stated rounding on an awkward estimate", () => {
    for (const minutes of [1, 7, 20, 95, 2401]) {
      for (const contract of [10_000, 400_000, 123_456]) {
        const rate = impliedRateCents(contract, minutes);
        expect(rate).not.toBeNull();
        // Half a cent an hour, plus half a cent for every hour estimated.
        const slack = 0.5 + 0.5 * (minutes / 60);
        expect(
          Math.abs(costOfMinutes(minutes, rate as number) - contract),
        ).toBeLessThanOrEqual(slack);
      }
    }
  });
});

describe("impliedRateCents with nothing to divide by", () => {
  it("has no rate to report when nobody has estimated the work", () => {
    expect(impliedRateCents(400_000, 0)).toBeNull();
  });

  it("does not call an unestimated project a project that pays nothing", () => {
    expect(impliedRateCents(400_000, 0)).not.toBe(0);
  });

  it("has no rate for an unestimated project worth nothing either", () => {
    expect(impliedRateCents(0, 0)).toBeNull();
  });

  it("refuses to divide by an estimate below zero", () => {
    expect(impliedRateCents(400_000, -2400)).toBeNull();
  });

  it("will not flip the sign of a contract on a negative estimate", () => {
    // Dividing straight through would read as the client being paid.
    expect(impliedRateCents(400_000, -60)).toBeNull();
  });
});

describe("impliedRateCents on a contract below zero", () => {
  /**
   * The contract value column takes a negative — `parseCents` accepts a minus
   * sign, because a credit on an invoice needs one. A negative contract value
   * is somebody's mistake, and the rate it implies is the clearest possible
   * statement of it. Reporting null here would hide a bad row behind the same
   * blank a missing estimate shows.
   */
  it("reports the negative rate a negative contract implies", () => {
    expect(impliedRateCents(-400_000, 2400)).toBe(-10_000);
  });

  it("tells a negative contract apart from a missing estimate", () => {
    expect(impliedRateCents(-400_000, 2400)).not.toBeNull();
  });

  it("still refuses when both the contract and the estimate are negative", () => {
    expect(impliedRateCents(-400_000, -2400)).toBeNull();
  });

  it("rounds a negative rate to the nearest cent, not towards zero", () => {
    // -$100 over seven hours is -$14.2857…/hr.
    expect(impliedRateCents(-10_000, 420)).toBe(-1_429);
  });

  it("does not describe a project as paying minus nothing an hour", () => {
    // -25c over sixty hours rounds to nothing, with a sign on it.
    expect(Object.is(impliedRateCents(-25, 3600), 0)).toBe(true);
    expect(formatCents(impliedRateCents(-25, 3600) as number)).toBe("$0.00");
  });
});

describe("deliveredCount", () => {
  it("counts the lines marked done", () => {
    expect(
      deliveredCount([
        line(60, "done"),
        line(60, "started"),
        line(60, "done"),
      ]),
    ).toBe(2);
  });

  it("counts nothing while no line is done", () => {
    expect(deliveredCount([line(60, "pending"), line(60, "started")])).toBe(0);
  });

  it("counts nothing on an empty scope list", () => {
    expect(deliveredCount([])).toBe(0);
  });

  it("counts a delivered line that nobody ever sized", () => {
    expect(deliveredCount([line(0, "done")])).toBe(1);
  });

  it("tells a different story from the share when the lines differ in size", () => {
    // Four short lines done, one long one left.
    const lines = [
      line(60, "done"),
      line(60, "done"),
      line(60, "done"),
      line(60, "done"),
      line(720, "pending"),
    ];
    expect(deliveredCount(lines)).toBe(4);
    expect(deliveredShare(lines)).toBeCloseTo(0.25, 10);
  });
});

describe("deliveredShare", () => {
  it("weighs the share by estimate, not by line count", () => {
    // Four short lines done, one long one left: a quarter of the work.
    const lines = [
      line(60, "done"),
      line(60, "done"),
      line(60, "done"),
      line(60, "done"),
      line(720, "pending"),
    ];
    expect(deliveredShare(lines)).toBeCloseTo(240 / 960, 10);
  });

  it("is a half when half the estimate is done", () => {
    expect(deliveredShare([line(60, "done"), line(60, "pending")])).toBe(0.5);
  });

  it("is one when every line is delivered", () => {
    expect(deliveredShare([line(60, "done"), line(30, "done")])).toBe(1);
  });

  it("is zero when nothing is delivered yet", () => {
    expect(deliveredShare([line(60, "pending"), line(30, "started")])).toBe(0);
  });

  it("does not credit a line merely for being in progress", () => {
    expect(deliveredShare([line(60, "started"), line(60, "done")])).toBe(0.5);
  });

  it("reads back as the two minute totals it came from", () => {
    const lines = [line(90, "done"), line(30, "started"), line(60, "pending")];
    expect(deliveredShare(lines)).toBe(
      deliveredEstimatedMinutes(lines) / totalEstimatedMinutes(lines),
    );
  });
});

describe("deliveredShare with no estimate behind it", () => {
  it("has no share to report on an empty scope list", () => {
    expect(deliveredShare([])).toBeNull();
  });

  it("has no share when no line has been sized", () => {
    expect(deliveredShare([line(0, "done"), line(0, "pending")])).toBeNull();
  });

  it("does not say a list of unsized lines is untouched", () => {
    expect(deliveredShare([line(0, "done")])).not.toBe(0);
  });

  it("ignores unsized lines when some of the list is estimated", () => {
    expect(
      deliveredShare([line(0, "pending"), line(60, "done")]),
    ).toBe(1);
  });

  it("has no share when the estimates cancel out to nothing", () => {
    expect(
      deliveredShare([line(60, "done"), line(-60, "pending")]),
    ).toBeNull();
  });

  it("has no share when the estimates total below zero", () => {
    expect(deliveredShare([line(-60, "done")])).toBeNull();
  });

  it("reports a share past one rather than hiding a bad row", () => {
    // The delivered line is sized above the total, which cannot be right.
    expect(
      deliveredShare([line(120, "done"), line(-30, "pending")]),
    ).toBeCloseTo(120 / 90, 10);
  });

  it("reports a share below zero for the same reason", () => {
    expect(
      deliveredShare([line(-30, "done"), line(120, "pending")]),
    ).toBeCloseTo(-30 / 90, 10);
  });
});

describe("summariseScope", () => {
  /** Twelve hours of scope, a third of it delivered, agreed at $4,000. */
  const LINES = [
    line(240, "done"),
    line(180, "started"),
    line(300, "pending"),
  ];

  it("summarises an ordinary project", () => {
    expect(summariseScope(LINES, 400_000)).toEqual({
      lineCount: 3,
      unestimatedCount: 0,
      deliveredCount: 1,
      estimatedMinutes: 720,
      estimatedHours: 12,
      remainingMinutes: 480,
      remainingHours: 8,
      deliveredMinutes: 240,
      deliveredHours: 4,
      deliveredShare: 240 / 720,
      contractValueCents: 400_000,
      // $4,000 over twelve hours.
      impliedRateCents: 33_333,
    });
  });

  it("echoes the contract value the rate was worked out from", () => {
    expect(summariseScope(LINES, 400_000).contractValueCents).toBe(400_000);
  });

  it("agrees with each function it is built from", () => {
    const summary = summariseScope(LINES, 400_000);
    expect(summary.estimatedMinutes).toBe(totalEstimatedMinutes(LINES));
    expect(summary.remainingMinutes).toBe(remainingEstimatedMinutes(LINES));
    expect(summary.deliveredMinutes).toBe(deliveredEstimatedMinutes(LINES));
    expect(summary.deliveredShare).toBe(deliveredShare(LINES));
    expect(summary.unestimatedCount).toBe(unestimatedCount(LINES));
    expect(summary.deliveredCount).toBe(deliveredCount(LINES));
    expect(summary.impliedRateCents).toBe(
      impliedRateCents(400_000, totalEstimatedMinutes(LINES)),
    );
  });

  it("quotes both totals in hours as well as minutes", () => {
    const summary = summariseScope(LINES, 400_000);
    expect(summary.estimatedHours).toBe(estimatedHours(720));
    expect(summary.remainingHours).toBe(estimatedHours(480));
    expect(summary.deliveredHours).toBe(estimatedHours(240));
  });

  it("keeps the delivered and remaining minutes adding up", () => {
    const summary = summariseScope(LINES, 400_000);
    expect(summary.deliveredMinutes + summary.remainingMinutes).toBe(
      summary.estimatedMinutes,
    );
  });
});

describe("summariseScope with nothing agreed yet", () => {
  it("summarises a project with no deliverables at all", () => {
    expect(summariseScope([], 400_000)).toEqual({
      lineCount: 0,
      unestimatedCount: 0,
      deliveredCount: 0,
      estimatedMinutes: 0,
      estimatedHours: 0,
      remainingMinutes: 0,
      remainingHours: 0,
      deliveredMinutes: 0,
      deliveredHours: 0,
      deliveredShare: null,
      contractValueCents: 400_000,
      impliedRateCents: null,
    });
  });

  it("does not claim a rate or a share for an empty scope list", () => {
    const summary = summariseScope([], 400_000);
    expect(summary.impliedRateCents).toBeNull();
    expect(summary.deliveredShare).toBeNull();
  });

  it("counts the lines of an unestimated list and totals none of them", () => {
    const summary = summariseScope([line(0), line(0)], 400_000);
    expect(summary.lineCount).toBe(2);
    expect(summary.unestimatedCount).toBe(2);
    expect(summary.estimatedMinutes).toBe(0);
    expect(summary.impliedRateCents).toBeNull();
  });

  it("totals the sized part of a half-estimated list", () => {
    const summary = summariseScope(
      [line(0, "pending"), line(120, "pending")],
      400_000,
    );
    expect(summary.unestimatedCount).toBe(1);
    expect(summary.estimatedMinutes).toBe(120);
    expect(summary.estimatedHours).toBe(2);
    // $4,000 for the two hours anybody has actually sized.
    expect(summary.impliedRateCents).toBe(200_000);
  });

  it("summarises a project nobody has priced", () => {
    const summary = summariseScope([line(120, "done")], 0);
    expect(summary.contractValueCents).toBe(0);
    expect(summary.impliedRateCents).toBe(0);
    expect(summary.deliveredShare).toBe(1);
  });
});

describe("summariseScope on rows that should not exist", () => {
  /**
   * Neither a negative estimate nor a negative contract value can be written
   * through the forms or the data layer. Both are reachable by hand, and the
   * summary is what somebody will be looking at when they try to work out
   * what went wrong — so it reports the numbers rather than refusing.
   */
  it("summarises a list with a negative estimate in it", () => {
    const summary = summariseScope(
      [line(120, "done"), line(-30, "pending")],
      400_000,
    );
    expect(summary.estimatedMinutes).toBe(90);
    expect(summary.remainingMinutes).toBe(-30);
    expect(summary.deliveredMinutes).toBe(120);
    // Past one, which is the visible sign that a row is wrong.
    expect(summary.deliveredShare).toBeCloseTo(120 / 90, 10);
  });

  it("has no rate when the estimates cancel each other out", () => {
    const summary = summariseScope(
      [line(120, "done"), line(-120, "pending")],
      400_000,
    );
    expect(summary.estimatedMinutes).toBe(0);
    expect(summary.estimatedHours).toBe(0);
    expect(summary.impliedRateCents).toBeNull();
  });

  it("has no rate when the estimates total below zero", () => {
    const summary = summariseScope([line(-120, "pending")], 400_000);
    expect(summary.estimatedMinutes).toBe(-120);
    expect(summary.estimatedHours).toBe(-2);
    expect(summary.impliedRateCents).toBeNull();
  });

  it("shows the negative rate a mistyped contract value implies", () => {
    const summary = summariseScope([line(120, "pending")], -400_000);
    expect(summary.contractValueCents).toBe(-400_000);
    expect(summary.impliedRateCents).toBe(-200_000);
  });

  it("does not let a bad contract value disturb the estimate totals", () => {
    const good = summariseScope([line(120, "pending")], 400_000);
    const bad = summariseScope([line(120, "pending")], -400_000);
    expect(bad.estimatedMinutes).toBe(good.estimatedMinutes);
    expect(bad.remainingMinutes).toBe(good.remainingMinutes);
    expect(bad.deliveredShare).toBe(good.deliveredShare);
  });
});

describe("the summary over every arrangement of statuses", () => {
  /**
   * Four lines, one of them unsized, in all eighty-one combinations of the
   * three statuses. The individual tests pick the interesting cases; this one
   * exists so that no arrangement of a list is special, and so that the
   * identities a panel relies on are checked rather than reasoned about.
   */
  const ESTIMATES = [480, 180, 0, 60];
  const CONTRACT = 400_000;

  function arrangements(): ScopeLine[][] {
    let lists: ScopeLine[][] = [[]];
    for (const minutes of ESTIMATES) {
      lists = lists.flatMap((prefix) =>
        DELIVERABLE_STATUSES.map((status) => [
          ...prefix,
          line(minutes, status),
        ]),
      );
    }
    return lists;
  }

  it("covers every combination", () => {
    expect(arrangements()).toHaveLength(3 ** ESTIMATES.length);
  });

  it("splits the estimate in two with nothing lost or double counted", () => {
    for (const lines of arrangements()) {
      const summary = summariseScope(lines, CONTRACT);
      expect(summary.estimatedMinutes).toBe(720);
      expect(summary.deliveredMinutes + summary.remainingMinutes).toBe(
        summary.estimatedMinutes,
      );
    }
  });

  it("counts every line exactly once", () => {
    for (const lines of arrangements()) {
      const summary = summariseScope(lines, CONTRACT);
      expect(summary.lineCount).toBe(ESTIMATES.length);
      expect(summary.deliveredCount).toBeLessThanOrEqual(summary.lineCount);
      expect(summary.unestimatedCount).toBe(1);
    }
  });

  it("keeps the share between nothing and all of it", () => {
    for (const lines of arrangements()) {
      const share = summariseScope(lines, CONTRACT).deliveredShare;
      expect(share).not.toBeNull();
      expect(share as number).toBeGreaterThanOrEqual(0);
      expect(share as number).toBeLessThanOrEqual(1);
    }
  });

  it("reports the same rate however the work has progressed", () => {
    for (const lines of arrangements()) {
      // The estimate does not change as lines are delivered, so neither does
      // what the contract works out to per hour.
      expect(summariseScope(lines, CONTRACT).impliedRateCents).toBe(
        impliedRateCents(CONTRACT, 720),
      );
    }
  });
});

describe("what marking one line done does to the totals", () => {
  /**
   * The direction a scope summary is allowed to move. Delivering work can
   * only take minutes out of what is left, and nothing else about the project
   * — its estimate, its contract, its implied rate — may move at all. A panel
   * that drifted in any other direction would be reporting progress nobody
   * made.
   */
  const LINES = [line(480, "pending"), line(180, "started"), line(60, "done")];

  function withLineDone(index: number): ScopeLine[] {
    return LINES.map((held, at) =>
      at === index ? { ...held, status: "done" as const } : held,
    );
  }

  it("never leaves more work outstanding than before", () => {
    const before = summariseScope(LINES, 400_000);
    for (let index = 0; index < LINES.length; index++) {
      const after = summariseScope(withLineDone(index), 400_000);
      expect(after.remainingMinutes).toBeLessThanOrEqual(
        before.remainingMinutes,
      );
      expect(after.deliveredMinutes).toBeGreaterThanOrEqual(
        before.deliveredMinutes,
      );
    }
  });

  it("moves exactly that line's estimate across", () => {
    const before = summariseScope(LINES, 400_000);
    const after = summariseScope(withLineDone(0), 400_000);
    expect(before.remainingMinutes - after.remainingMinutes).toBe(480);
    expect(after.deliveredMinutes - before.deliveredMinutes).toBe(480);
  });

  it("changes nothing when the line was already done", () => {
    expect(summariseScope(withLineDone(2), 400_000)).toEqual(
      summariseScope(LINES, 400_000),
    );
  });

  it("leaves the estimate, the contract, and the rate alone", () => {
    const before = summariseScope(LINES, 400_000);
    for (let index = 0; index < LINES.length; index++) {
      const after = summariseScope(withLineDone(index), 400_000);
      expect(after.estimatedMinutes).toBe(before.estimatedMinutes);
      expect(after.estimatedHours).toBe(before.estimatedHours);
      expect(after.contractValueCents).toBe(before.contractValueCents);
      expect(after.impliedRateCents).toBe(before.impliedRateCents);
    }
  });
});

describe("what the estimate does to the implied rate", () => {
  /**
   * The thing the number is for. A fixed price does not change when somebody
   * adds another week to the estimate — the rate does, and this is the only
   * place in the codebase that says so. Each extra hour agreed for the same
   * money buys the work at a lower rate, strictly, with no plateau where
   * padding the estimate is free.
   */
  const CONTRACT = 400_000;

  it("falls as the estimate grows", () => {
    const rates = [60, 120, 600, 2400, 4800].map(
      (minutes) => impliedRateCents(CONTRACT, minutes) as number,
    );
    for (let at = 1; at < rates.length; at++) {
      expect(rates[at]).toBeLessThan(rates[at - 1]);
    }
  });

  it("halves when the estimate doubles", () => {
    expect(impliedRateCents(CONTRACT, 4800)).toBe(
      (impliedRateCents(CONTRACT, 2400) as number) / 2,
    );
  });

  it("rises as the contract value grows against a fixed estimate", () => {
    const rates = [100, 10_000, 400_000, 1_000_000].map(
      (contract) => impliedRateCents(contract, 2400) as number,
    );
    for (let at = 1; at < rates.length; at++) {
      expect(rates[at]).toBeGreaterThan(rates[at - 1]);
    }
  });

  it("drops a line's worth of rate when a line is added to the scope", () => {
    const agreed = [line(1200, "pending"), line(1200, "pending")];
    const widened = [...agreed, line(1200, "pending")];
    const before = summariseScope(agreed, CONTRACT);
    const after = summariseScope(widened, CONTRACT);
    // $4,000 over forty hours, then over sixty.
    expect(before.impliedRateCents).toBe(10_000);
    expect(after.impliedRateCents).toBe(6_667);
    expect(after.remainingMinutes).toBeGreaterThan(before.remainingMinutes);
  });
});

describe("the hours a summary quotes beside its minutes", () => {
  /**
   * Each hour figure is its own total rounded to the hundredth, so the three
   * of them need not add up the way the minutes do. The discrepancy is a
   * hundredth of an hour and it is documented rather than engineered away —
   * but it is pinned here, because the alternative is a panel author
   * discovering it from a screenshot.
   */
  it("adds up exactly when the totals fall on whole hundredths", () => {
    const summary = summariseScope(
      [line(240, "done"), line(480, "pending")],
      400_000,
    );
    expect(summary.deliveredHours + summary.remainingHours).toBe(
      summary.estimatedHours,
    );
  });

  it("can be a hundredth of an hour out when they do not", () => {
    const summary = summariseScope(
      [line(10, "done"), line(10, "pending")],
      400_000,
    );
    expect(summary.deliveredHours).toBe(0.17);
    expect(summary.remainingHours).toBe(0.17);
    expect(summary.estimatedHours).toBe(0.33);
  });

  it("is never more than a hundredth out, however the list is split", () => {
    for (let delivered = 0; delivered <= 120; delivered++) {
      const summary = summariseScope(
        [line(delivered, "done"), line(120 - delivered, "pending")],
        400_000,
      );
      expect(
        Math.abs(
          summary.deliveredHours +
            summary.remainingHours -
            summary.estimatedHours,
        ),
      ).toBeLessThanOrEqual(0.01);
    }
  });

  it("keeps the minutes adding up exactly whatever the hours do", () => {
    for (let delivered = 0; delivered <= 120; delivered++) {
      const summary = summariseScope(
        [line(delivered, "done"), line(120 - delivered, "pending")],
        400_000,
      );
      expect(summary.deliveredMinutes + summary.remainingMinutes).toBe(
        summary.estimatedMinutes,
      );
    }
  });
});
