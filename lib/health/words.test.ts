import { describe, expect, it } from "vitest";

import {
  NOT_ASSESSED_HEADLINE,
  SCOPE_HEALTH_HEADLINE,
} from "@/lib/projects/scope-health";
import {
  CREEP_BLIND_SPOTS,
  CREEP_REASONS,
  SCOPE_HEALTH,
} from "@/lib/scope-creep";

import { RISK_BANDS, riskBand, UNASSESSED_BAND } from "./band";
import {
  BLIND_SPOT_CLAUSE,
  firstBlindSpotClause,
  REASON_CLAUSE,
  RISK_BAND_LABELS,
  riskBandLabel,
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
