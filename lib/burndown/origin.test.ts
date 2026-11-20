import { describe, expect, it } from "vitest";

import {
  BURN_SNAPSHOT_ORIGINS,
  DEFAULT_BURN_SNAPSHOT_ORIGIN,
  isBurnSnapshotOrigin,
} from "./origin";

describe("isBurnSnapshotOrigin", () => {
  it("accepts every origin in the list", () => {
    for (const origin of BURN_SNAPSHOT_ORIGINS) {
      expect(isBurnSnapshotOrigin(origin)).toBe(true);
    }
  });

  it("accepts the default, which is why it can be written unguarded", () => {
    expect(isBurnSnapshotOrigin(DEFAULT_BURN_SNAPSHOT_ORIGIN)).toBe(true);
  });

  it("rejects a word that is not one of them", () => {
    expect(isBurnSnapshotOrigin("guessed")).toBe(false);
    expect(isBurnSnapshotOrigin("Recorded")).toBe(false);
  });

  it("rejects a value that is not a string at all", () => {
    expect(isBurnSnapshotOrigin(null)).toBe(false);
    expect(isBurnSnapshotOrigin(undefined)).toBe(false);
    expect(isBurnSnapshotOrigin(0)).toBe(false);
  });
});
