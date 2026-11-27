import { describe, expect, it } from "vitest";

import {
  NOT_ASSESSED_HEADLINE,
  SCOPE_HEALTH_HEADLINE,
} from "@/lib/projects/scope-health";
import { SCOPE_HEALTH } from "@/lib/scope-creep";

import { RISK_BANDS, riskBand, UNASSESSED_BAND } from "./band";
import { RISK_BAND_LABELS, riskBandLabel } from "./words";

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
