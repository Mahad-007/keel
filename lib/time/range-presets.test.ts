import { describe, expect, it } from "vitest";

import { ALL_DATES } from "./range";
import {
  ANY_DATE,
  LAST_30_DAYS,
  presetRange,
  RANGE_PRESETS,
  THIS_MONTH,
  THIS_WEEK,
} from "./range-presets";

/** A Friday, so the week it is in runs across neither a month nor a year. */
const FRIDAY = "2026-10-16";

describe("presetRange", () => {
  it("makes this week Monday to Sunday", () => {
    expect(presetRange(THIS_WEEK, FRIDAY)).toEqual({
      from: "2026-10-12",
      to: "2026-10-18",
    });
  });

  it("makes this month the first to the last day of it", () => {
    expect(presetRange(THIS_MONTH, FRIDAY)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("knows how long a short month is", () => {
    expect(presetRange(THIS_MONTH, "2024-02-11")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
  });

  it("counts the last thirty days inclusive of today", () => {
    expect(presetRange(LAST_30_DAYS, FRIDAY)).toEqual({
      from: "2026-09-17",
      to: FRIDAY,
    });
  });

  it("reaches back across a month boundary", () => {
    expect(presetRange(LAST_30_DAYS, "2026-01-05")).toEqual({
      from: "2025-12-07",
      to: "2026-01-05",
    });
  });

  it("filters no dates at all for the unfiltered preset", () => {
    expect(presetRange(ANY_DATE, FRIDAY)).toEqual(ALL_DATES);
  });

  it("falls back to every date when today cannot be reached back from", () => {
    for (const preset of RANGE_PRESETS) {
      expect(presetRange(preset, "0000-01-02")).toEqual(ALL_DATES);
      expect(presetRange(preset, "nonsense")).toEqual(ALL_DATES);
    }
  });

  it("gives every preset a range in the right order", () => {
    for (const preset of RANGE_PRESETS) {
      const { from, to } = presetRange(preset, FRIDAY);
      if (from !== null && to !== null) expect(from <= to).toBe(true);
    }
  });
});
