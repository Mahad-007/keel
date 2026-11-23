import { describe, expect, it } from "vitest";

import {
  confidenceSeverity,
  PROJECTION_CONFIDENCE,
  worstConfidence,
} from "./confidence";

describe("confidenceSeverity", () => {
  it("ranks the grades worst last", () => {
    expect(confidenceSeverity("firm")).toBeLessThan(
      confidenceSeverity("indicative"),
    );
    expect(confidenceSeverity("indicative")).toBeLessThan(
      confidenceSeverity("weak"),
    );
  });

  it("ranks every grade the list declares", () => {
    for (const confidence of PROJECTION_CONFIDENCE) {
      expect(confidenceSeverity(confidence)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("worstConfidence", () => {
  it("takes the worse of two grades", () => {
    expect(worstConfidence("firm", "weak")).toBe("weak");
    expect(worstConfidence("weak", "firm")).toBe("weak");
    expect(worstConfidence("firm", "indicative")).toBe("indicative");
  });

  it("leaves a pair of equal grades alone", () => {
    expect(worstConfidence("indicative", "indicative")).toBe("indicative");
  });

  it("does not average: one weak input makes the whole thing weak", () => {
    const graded = (["firm", "firm", "firm", "weak"] as const).reduce(
      worstConfidence,
      "firm" as const,
    );
    expect(graded).toBe("weak");
  });

  it("is the same answer whichever order the pair arrives in", () => {
    for (const a of PROJECTION_CONFIDENCE) {
      for (const b of PROJECTION_CONFIDENCE) {
        expect(worstConfidence(a, b)).toBe(worstConfidence(b, a));
      }
    }
  });
});
