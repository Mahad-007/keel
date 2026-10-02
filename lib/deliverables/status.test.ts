import { describe, expect, it } from "vitest";

import {
  DEFAULT_DELIVERABLE_STATUS,
  DELIVERABLE_STATUSES,
  isDeliverableStatus,
} from "./status";

describe("isDeliverableStatus", () => {
  it("accepts every status in the list", () => {
    for (const status of DELIVERABLE_STATUSES) {
      expect(isDeliverableStatus(status)).toBe(true);
    }
  });

  it("accepts the default, so a new row is always a valid one", () => {
    expect(isDeliverableStatus(DEFAULT_DELIVERABLE_STATUS)).toBe(true);
  });

  it("rejects a word that only looks like a status", () => {
    expect(isDeliverableStatus("complete")).toBe(false);
    expect(isDeliverableStatus("Done")).toBe(false);
    expect(isDeliverableStatus("in-progress")).toBe(false);
  });

  it("rejects everything that is not a string", () => {
    expect(isDeliverableStatus(undefined)).toBe(false);
    expect(isDeliverableStatus(null)).toBe(false);
    expect(isDeliverableStatus(0)).toBe(false);
    expect(isDeliverableStatus(["done"])).toBe(false);
  });

  it("rejects the empty string, which an unfilled select submits", () => {
    expect(isDeliverableStatus("")).toBe(false);
  });
});
