import { describe, expect, it } from "vitest";

import {
  DEFAULT_DELIVERABLE_STATUS,
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_LABELS,
  deliverableStatusLabel,
  isDeliverableStatus,
  parseDeliverableStatus,
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

describe("parseDeliverableStatus", () => {
  it("hands back the status it was given", () => {
    for (const status of DELIVERABLE_STATUSES) {
      expect(parseDeliverableStatus(status)).toBe(status);
    }
  });

  it("throws on anything else, naming the value it refused", () => {
    expect(() => parseDeliverableStatus("shipped")).toThrow(/"shipped"/);
  });

  it("lists the statuses it would have accepted", () => {
    expect(() => parseDeliverableStatus(null)).toThrow(
      /pending, started, done/,
    );
  });
});

describe("deliverableStatusLabel", () => {
  it("labels every status", () => {
    for (const status of DELIVERABLE_STATUSES) {
      expect(deliverableStatusLabel(status)).toBe(
        DELIVERABLE_STATUS_LABELS[status],
      );
    }
  });

  it("gives no two statuses the same label", () => {
    const labels = Object.values(DELIVERABLE_STATUS_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("shows a hand-edited value rather than an empty cell", () => {
    expect(
      deliverableStatusLabel("abandoned" as (typeof DELIVERABLE_STATUSES)[number]),
    ).toBe("abandoned");
  });
});
