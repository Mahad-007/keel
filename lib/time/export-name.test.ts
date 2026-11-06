import { describe, expect, it } from "vitest";

import { downloadFilename } from "@/lib/download";

import {
  ANY_BILLING,
  CHARGEABLE_TIME,
  FREE_TIME,
} from "./billable";
import {
  billingNamePart,
  rangeNamePart,
  timeLogFilename,
  ALL_TIME_PART,
} from "./export-name";
import { ALL_DATES } from "./range";

describe("rangeNamePart", () => {
  it("names a closed range by both its days", () => {
    expect(rangeNamePart({ from: "2026-10-01", to: "2026-10-31" })).toBe(
      "2026-10-01-to-2026-10-31",
    );
  });

  it("names one day once", () => {
    expect(rangeNamePart({ from: "2026-10-16", to: "2026-10-16" })).toBe(
      "2026-10-16",
    );
  });

  it("says which end is open", () => {
    expect(rangeNamePart({ from: "2026-10-01", to: null })).toBe(
      "from-2026-10-01",
    );
    expect(rangeNamePart({ from: null, to: "2026-10-31" })).toBe(
      "to-2026-10-31",
    );
  });

  it("names a range with both ends open", () => {
    expect(rangeNamePart(ALL_DATES)).toBe(ALL_TIME_PART);
  });

  it("names a backwards range as it was typed", () => {
    expect(rangeNamePart({ from: "2026-10-31", to: "2026-10-01" })).toBe(
      "2026-10-31-to-2026-10-01",
    );
  });

  it("comes back as something a filename can hold", () => {
    expect(rangeNamePart({ from: "2026-10-01", to: "2026-10-31" })).toMatch(
      /^[a-z0-9-]+$/,
    );
    expect(rangeNamePart(ALL_DATES)).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("billingNamePart", () => {
  it("names each half of the filter in words a reader would use", () => {
    expect(billingNamePart(CHARGEABLE_TIME)).toBe("chargeable");
    expect(billingNamePart(FREE_TIME)).toBe("not-chargeable");
  });

  it("says nothing when both halves are in the file", () => {
    expect(billingNamePart(ANY_BILLING)).toBeNull();
  });
});

describe("timeLogFilename", () => {
  it("names an unfiltered export", () => {
    expect(timeLogFilename({ range: ALL_DATES, billable: ANY_BILLING })).toBe(
      "keel-time-all-time.csv",
    );
  });

  it("names a month of chargeable time", () => {
    expect(
      timeLogFilename({
        range: { from: "2026-10-01", to: "2026-10-31" },
        billable: CHARGEABLE_TIME,
      }),
    ).toBe("keel-time-2026-10-01-to-2026-10-31-chargeable.csv");
  });

  it("leaves the billing state out when it narrows nothing", () => {
    expect(
      timeLogFilename({
        range: { from: "2026-10-01", to: "2026-10-31" },
        billable: ANY_BILLING,
      }),
    ).toBe("keel-time-2026-10-01-to-2026-10-31.csv");
  });

  it("names the time given away since a day", () => {
    expect(
      timeLogFilename({
        range: { from: "2026-10-01", to: null },
        billable: FREE_TIME,
      }),
    ).toBe("keel-time-from-2026-10-01-not-chargeable.csv");
  });

  it("holds nothing a filename has to be cleaned of", () => {
    const name = timeLogFilename({
      range: { from: "2026-10-01", to: "2026-10-31" },
      billable: FREE_TIME,
    });

    expect(name).toBe(downloadFilename(name));
  });
});
