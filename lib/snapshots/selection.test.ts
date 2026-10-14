import { describe, expect, it } from "vitest";

import {
  chosenSnapshot,
  readSnapshotParam,
  snapshotComparisonHref,
} from "./selection";
import type { SummarisedSnapshot } from "./summary";

function snapshot(id: string, capturedAt: string): SummarisedSnapshot {
  return {
    id,
    label: null,
    capturedAt,
    contractValueCents: 0,
    lineCount: 1,
    estimatedMinutes: 60,
    unestimatedCount: 0,
    negativeEstimateCount: 0,
  };
}

const NEWEST = snapshot("snp_new", "2026-10-13T09:00:00.000Z");
const OLDEST = snapshot("snp_old", "2026-03-01T09:00:00.000Z");
/** As the data layer reads them: newest first. */
const SNAPSHOTS = [NEWEST, OLDEST];

describe("snapshotComparisonHref", () => {
  it("addresses the scope tab of the project, naming the snapshot", () => {
    expect(snapshotComparisonHref("prj_1", "snp_1")).toBe(
      "/projects/prj_1?tab=scope&snapshot=snp_1",
    );
  });

  it("escapes an id that would otherwise change the query", () => {
    expect(snapshotComparisonHref("prj_1", "snp&tab=overview")).toBe(
      "/projects/prj_1?tab=scope&snapshot=snp%26tab%3Doverview",
    );
  });
});

describe("readSnapshotParam", () => {
  it("reads the snapshot a link named", () => {
    expect(readSnapshotParam({ snapshot: "snp_1" })).toBe("snp_1");
  });

  it("answers nothing when no snapshot was named", () => {
    expect(readSnapshotParam({})).toBeUndefined();
  });

  it("takes the first of a repeated param, as every other param does", () => {
    expect(readSnapshotParam({ snapshot: ["snp_1", "snp_2"] })).toBe("snp_1");
  });
});

describe("chosenSnapshot", () => {
  it("compares against the snapshot asked for", () => {
    expect(chosenSnapshot("snp_old", SNAPSHOTS)).toBe(OLDEST);
  });

  it("defaults to the most recent, which the list leads with", () => {
    expect(chosenSnapshot(undefined, SNAPSHOTS)).toBe(NEWEST);
  });

  it("falls back to the most recent for a snapshot that is gone", () => {
    // A stale link should land on a comparison rather than an error page.
    expect(chosenSnapshot("snp_deleted", SNAPSHOTS)).toBe(NEWEST);
  });

  it("has nothing to compare against on a project never snapshotted", () => {
    expect(chosenSnapshot(undefined, [])).toBeNull();
    expect(chosenSnapshot("snp_1", [])).toBeNull();
  });
});
