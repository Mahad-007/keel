import { describe, expect, it } from "vitest";

import {
  axisDateLabel,
  axisMoneyLabel,
  dateAxisTicks,
  compactMoneyLabel,
  moneyAxisTicks,
  moneyTickStep,
} from "./axis";

describe("axisMoneyLabel", () => {
  it("writes a round amount in dollars alone", () => {
    expect(axisMoneyLabel(400_000)).toBe("$4,000");
    expect(axisMoneyLabel(0)).toBe("$0");
  });

  it("separates the thousands the way the figures above it do", () => {
    expect(axisMoneyLabel(1_250_000)).toBe("$12,500");
  });

  it("marks an overrun as money below nothing", () => {
    expect(axisMoneyLabel(-100_000)).toBe("-$1,000");
  });

  it("writes minus nothing as nothing", () => {
    // An axis that straddles zero reaches it by rounding a negative figure
    // upwards, which lands on -0 rather than on zero.
    expect(axisMoneyLabel(-0)).toBe("$0");
  });

  it("keeps the cents of a tick that is not whole dollars", () => {
    // Only a very short axis lands here, and rounding would put the label at
    // a figure the gridline beside it is not drawn at.
    expect(axisMoneyLabel(1_250)).toBe("$12.50");
    expect(axisMoneyLabel(7)).toBe("$0.07");
  });
});

describe("compactMoneyLabel", () => {
  it("shortens thousands", () => {
    expect(compactMoneyLabel(1_000_000)).toBe("$10K");
    expect(compactMoneyLabel(5_000_000)).toBe("$50K");
  });

  it("shortens millions", () => {
    expect(compactMoneyLabel(100_000_000)).toBe("$1M");
    expect(compactMoneyLabel(124_000_000)).toBe("$1.2M");
  });

  it("keeps one decimal where a half step needs it", () => {
    expect(compactMoneyLabel(1_250_000)).toBe("$12.5K");
  });

  it("drops a trailing zero rather than printing a column of them", () => {
    expect(compactMoneyLabel(1_000_000)).not.toContain(".0");
  });

  it("writes an overrun below the line with its sign in front", () => {
    expect(compactMoneyLabel(-1_250_000)).toBe("-$12.5K");
    expect(compactMoneyLabel(-100_000_000)).toBe("-$1M");
  });

  it("leaves an amount under a thousand dollars written out", () => {
    expect(compactMoneyLabel(0)).toBe("$0");
    expect(compactMoneyLabel(50_000)).toBe("$500");
    expect(compactMoneyLabel(99_900)).toBe("$999");
  });

  it("switches units exactly at a thousand and at a million", () => {
    expect(compactMoneyLabel(99_999)).toBe("$999.99");
    expect(compactMoneyLabel(100_000)).toBe("$1K");
    expect(compactMoneyLabel(99_999_999)).toBe("$1000K");
    expect(compactMoneyLabel(100_000_000)).toBe("$1M");
  });
});

describe("moneyTickStep", () => {
  it("steps a five-thousand-dollar contract in thousands", () => {
    expect(moneyTickStep(500_000)).toBe(100_000);
  });

  it("steps an awkward contract in round figures anyway", () => {
    // $4,250 over four gaps is $1,062.50 a gap, which nobody says out loud.
    expect(moneyTickStep(425_000)).toBe(100_000);
  });

  it("takes an extra gridline over an axis labelled in odd figures", () => {
    for (const span of [500_000, 425_000, 1_234_567, 9_900, 80_000_000]) {
      const gaps = span / moneyTickStep(span);
      expect(gaps).toBeGreaterThan(2);
      expect(gaps).toBeLessThanOrEqual(7);
    }
  });

  it("only ever steps in one, two or five times a power of ten", () => {
    for (const span of [1, 99, 500_000, 425_000, 1_234_567, 80_000_000]) {
      const step = moneyTickStep(span);
      const magnitude = 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 5, 10]).toContain(step / magnitude);
    }
  });

  it("rounds to the nearest round step rather than always upwards", () => {
    // A quarter of this range is $1,100, which is nearer $1,000 than $2,000.
    expect(moneyTickStep(440_000)).toBe(100_000);
    // A quarter of this one is $1,900, which is nearer $2,000.
    expect(moneyTickStep(760_000)).toBe(200_000);
  });

  it("never steps by less than a cent", () => {
    expect(moneyTickStep(1)).toBe(1);
    expect(moneyTickStep(3)).toBe(1);
  });

  it("gives a range of nothing a step that can still be divided by", () => {
    expect(moneyTickStep(0)).toBe(1);
    expect(moneyTickStep(-500_000)).toBe(1);
  });
});

describe("moneyAxisTicks", () => {
  it("runs from the bottom of the range to the top", () => {
    expect(moneyAxisTicks(0, 500_000).map((tick) => tick.label)).toEqual([
      "$0",
      "$1,000",
      "$2,000",
      "$3,000",
      "$4,000",
      "$5,000",
    ]);
  });

  it("puts a gridline on the day the money runs out", () => {
    for (const [bottom, top] of [
      [0, 500_000],
      [-120_000, 500_000],
      [-40_000, 0],
    ]) {
      expect(moneyAxisTicks(bottom, top).map((t) => t.cents)).toContain(0);
    }
  });

  it("labels an overrun below the line", () => {
    expect(moneyAxisTicks(-300_000, 500_000).map((t) => t.label)).toEqual([
      "-$2,000",
      "$0",
      "$2,000",
      "$4,000",
    ]);
  });

  it("stops short of a contract value that is not a round figure", () => {
    const ticks = moneyAxisTicks(0, 425_000);
    expect(ticks[ticks.length - 1].cents).toBe(400_000);
  });

  it("shortens every label once the axis reaches five figures", () => {
    expect(moneyAxisTicks(0, 8_000_000).map((t) => t.label)).toEqual([
      "$0",
      "$20K",
      "$40K",
      "$60K",
      "$80K",
    ]);
  });

  it("keeps one style down the whole axis", () => {
    // $12,000 is shortened, so the $2,000 above zero is shortened too rather
    // than two ticks of one axis reading as two different quantities.
    const labels = moneyAxisTicks(0, 1_200_000).map((t) => t.label);
    expect(labels).toContain("$2K");
    expect(labels).not.toContain("$2,000");
  });

  it("writes a four-figure axis out in full", () => {
    expect(
      moneyAxisTicks(0, 500_000).every((t) => t.label.includes(",") || t.label === "$0"),
    ).toBe(true);
  });

  it("has no gridlines for a range with no height", () => {
    expect(moneyAxisTicks(0, 0)).toEqual([]);
    expect(moneyAxisTicks(500_000, 0)).toEqual([]);
  });

  it("steps upwards, each tick above the one before", () => {
    const ticks = moneyAxisTicks(-120_000, 500_000);
    expect(
      ticks.every((tick, at) => at === 0 || tick.cents > ticks[at - 1].cents),
    ).toBe(true);
  });
});

describe("axisDateLabel", () => {
  it("names the month and the day", () => {
    expect(axisDateLabel("2026-03-01")).toBe("Mar 1");
    expect(axisDateLabel("2026-12-25")).toBe("Dec 25");
  });

  it("drops the leading zero a stored day carries", () => {
    expect(axisDateLabel("2026-03-09")).toBe("Mar 9");
  });

  it("adds the year for a chart that crosses one", () => {
    expect(axisDateLabel("2026-12-28", true)).toBe("Dec 28, 2026");
    expect(axisDateLabel("2027-01-03", true)).toBe("Jan 3, 2027");
  });

  it("writes a year at the edge of the calendar in full", () => {
    // `formatYear` pads, so a date in year seven is not labelled "Jan 3, 7".
    expect(axisDateLabel("0007-01-03", true)).toBe("Jan 3, 0007");
  });

  it("hands back a day it cannot read, rather than failing to render", () => {
    expect(axisDateLabel("not a day")).toBe("not a day");
    expect(axisDateLabel("2026-13-01")).toBe("2026-13-01");
  });
});

describe("dateAxisTicks", () => {
  it("names both ends and the middle of a long chart", () => {
    expect(dateAxisTicks("2026-03-01", "2026-03-31")).toEqual([
      { onDate: "2026-03-01", label: "Mar 1", anchor: "start" },
      { onDate: "2026-03-16", label: "Mar 16", anchor: "middle" },
      { onDate: "2026-03-31", label: "Mar 31", anchor: "end" },
    ]);
  });

  it("names only the ends of a chart too short to halve", () => {
    expect(dateAxisTicks("2026-03-01", "2026-03-03")).toEqual([
      { onDate: "2026-03-01", label: "Mar 1", anchor: "start" },
      { onDate: "2026-03-03", label: "Mar 3", anchor: "end" },
    ]);
  });

  it("names the one day of a one-day chart, where its point is", () => {
    expect(dateAxisTicks("2026-03-01", "2026-03-01")).toEqual([
      { onDate: "2026-03-01", label: "Mar 1", anchor: "middle" },
    ]);
  });

  it("hangs the first and last labels inwards, off their own ticks", () => {
    const ticks = dateAxisTicks("2026-03-01", "2026-06-30");
    expect(ticks[0].anchor).toBe("start");
    expect(ticks[ticks.length - 1].anchor).toBe("end");
  });

  it("spells out the year on a chart that runs across one", () => {
    expect(dateAxisTicks("2026-12-01", "2027-01-31").map((t) => t.label)).toEqual([
      "Dec 1, 2026",
      "Jan 1, 2027",
      "Jan 31, 2027",
    ]);
  });

  it("leaves the year off a chart that stays inside one", () => {
    expect(
      dateAxisTicks("2026-01-01", "2026-12-31").every(
        (tick) => !tick.label.includes("2026"),
      ),
    ).toBe(true);
  });

  it("puts the middle tick in the middle of the calendar span", () => {
    // Not the middle of the readings: the axis is calendar time.
    expect(dateAxisTicks("2026-01-01", "2026-03-02")[1].onDate).toBe(
      "2026-01-31",
    );
  });

  it("refuses an end that is not a calendar date", () => {
    expect(() => dateAxisTicks("2026-03-01", "not a day")).toThrow(
      "not a calendar date",
    );
  });
});
