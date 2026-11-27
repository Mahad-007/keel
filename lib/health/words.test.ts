import { describe, expect, it } from "vitest";

import {
  formatSharePoints,
  NOT_ASSESSED_HEADLINE,
  SCOPE_HEALTH_HEADLINE,
} from "@/lib/projects/scope-health";
import { formatSharePercent } from "@/lib/projects/scope-summary";
import {
  CREEP_BLIND_SPOTS,
  CREEP_REASONS,
  SCOPE_HEALTH,
} from "@/lib/scope-creep";

import { RISK_BANDS, riskBand, UNASSESSED_BAND } from "./band";
import {
  BLIND_SPOT_CLAUSE,
  firstBlindSpotClause,
  gapCell,
  NO_FIGURE,
  REASON_CLAUSE,
  RISK_BAND_LABELS,
  riskBandLabel,
  shareCell,
} from "./words";

describe("riskBandLabel", () => {
  it("calls a verdict what the project banner calls it", () => {
    for (const health of SCOPE_HEALTH) {
      expect(riskBandLabel(riskBand(health))).toBe(
        SCOPE_HEALTH_HEADLINE[health],
      );
    }
  });

  it("calls a withheld verdict what the banner calls it", () => {
    expect(riskBandLabel(UNASSESSED_BAND)).toBe(NOT_ASSESSED_HEADLINE);
  });

  it("has a label for every band", () => {
    for (const band of RISK_BANDS) {
      expect(riskBandLabel(band)).not.toBe("");
    }
  });

  it("gives no two bands the same label", () => {
    const labels = Object.values(RISK_BAND_LABELS);

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("REASON_CLAUSE", () => {
  it("has a clause for every comparison the classifier flags on", () => {
    for (const reason of CREEP_REASONS) {
      expect(REASON_CLAUSE[reason]).toMatch(/\.$/);
    }
  });

  it("quotes no figures, which the columns carry", () => {
    for (const reason of CREEP_REASONS) {
      expect(REASON_CLAUSE[reason]).not.toMatch(/\d/);
    }
  });

  it("tells the two burn-against-delivery clauses apart", () => {
    expect(REASON_CLAUSE["burn-ahead-of-delivery"]).not.toBe(
      REASON_CLAUSE["burn-far-ahead-of-delivery"],
    );
  });
});

describe("BLIND_SPOT_CLAUSE", () => {
  it("has a clause for everything the classifier can fail to see", () => {
    for (const spot of CREEP_BLIND_SPOTS) {
      expect(BLIND_SPOT_CLAUSE[spot]).toMatch(/\.$/);
    }
  });

  it("gives no two blind spots the same clause", () => {
    const clauses = Object.values(BLIND_SPOT_CLAUSE);

    expect(new Set(clauses).size).toBe(clauses.length);
  });

  it("stays shorter than the banner's version of the same fact", () => {
    for (const spot of CREEP_BLIND_SPOTS) {
      expect(BLIND_SPOT_CLAUSE[spot].length).toBeLessThan(140);
    }
  });
});

describe("firstBlindSpotClause", () => {
  it("says nothing when the verdict saw everything", () => {
    expect(firstBlindSpotClause([])).toBeNull();
  });

  it("reads the one blind spot there is", () => {
    expect(firstBlindSpotClause(["burn-not-valued"])).toBe(
      BLIND_SPOT_CLAUSE["burn-not-valued"],
    );
  });

  it("leads with the money gap, which the classifier puts first", () => {
    expect(
      firstBlindSpotClause(["no-contract-value", "scope-not-estimated"]),
    ).toBe(BLIND_SPOT_CLAUSE["no-contract-value"]);
  });
});

describe("shareCell", () => {
  it("prints a share the way the burn panel prints it", () => {
    expect(shareCell(0.8)).toBe(formatSharePercent(0.8));
    expect(shareCell(1.63)).toBe("163%");
  });

  it("prints a share that could not be read as a dash", () => {
    expect(shareCell(null)).toBe(NO_FIGURE);
  });

  it("does not print an unreadable share as nothing consumed", () => {
    expect(shareCell(null)).not.toBe(shareCell(0));
  });

  it("prints a tiny share as something rather than nothing", () => {
    expect(shareCell(0.001)).toBe("less than 1%");
  });
});

describe("gapCell", () => {
  it("prints a gap in points the way the banner does", () => {
    expect(gapCell(0.65)).toBe(formatSharePoints(0.65));
    expect(gapCell(0.65)).toBe("65 points");
  });

  it("prints a delivery ahead of the burn as a negative gap", () => {
    expect(gapCell(-0.12)).toBe("-12 points");
  });

  it("prints a gap that could not be read as a dash", () => {
    expect(gapCell(null)).toBe(NO_FIGURE);
  });

  it("does not print an unreadable gap as no gap at all", () => {
    expect(gapCell(null)).not.toBe(gapCell(0));
  });
});
