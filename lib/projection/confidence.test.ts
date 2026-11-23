import { describe, expect, it } from "vitest";

import {
  CAVEAT_CONFIDENCE,
  confidenceSeverity,
  PROJECTION_CAVEATS,
  projectionConfidence,
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

describe("CAVEAT_CONFIDENCE", () => {
  it("grades every caveat the list declares", () => {
    for (const caveat of PROJECTION_CAVEATS) {
      expect(PROJECTION_CONFIDENCE).toContain(CAVEAT_CONFIDENCE[caveat]);
    }
  });

  it("never grades a caveat firm", () => {
    // A caveat that cost the forecast nothing would be a sentence with no
    // consequence, and a reader would learn to skip the list.
    for (const caveat of PROJECTION_CAVEATS) {
      expect(CAVEAT_CONFIDENCE[caveat]).not.toBe("firm");
    }
  });

  it("grades the caveats that undermine the basis weak", () => {
    expect(CAVEAT_CONFIDENCE["short-history"]).toBe("weak");
    expect(CAVEAT_CONFIDENCE["few-readings"]).toBe("weak");
    expect(CAVEAT_CONFIDENCE["no-scope"]).toBe("weak");
  });
});

describe("projectionConfidence", () => {
  it("is firm when nothing is wrong with the inputs", () => {
    expect(projectionConfidence([])).toBe("firm");
  });

  it("takes the worst of several caveats", () => {
    expect(
      projectionConfidence(["reconstructed-history", "short-history"]),
    ).toBe("weak");
  });

  it("is unmoved by how many caveats of the same grade there are", () => {
    // Three approximations do not add up to no basis at all.
    expect(
      projectionConfidence([
        "reconstructed-history",
        "stale-readings",
        "unsized-scope",
        "pace-changed",
      ]),
    ).toBe("indicative");
  });

  it("does not let clean inputs offset a weak one", () => {
    expect(projectionConfidence(["no-scope"])).toBe("weak");
  });

  it("grades a single caveat as that caveat's own grade", () => {
    for (const caveat of PROJECTION_CAVEATS) {
      expect(projectionConfidence([caveat])).toBe(CAVEAT_CONFIDENCE[caveat]);
    }
  });
});
