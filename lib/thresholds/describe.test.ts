import { describe, expect, it } from "vitest";

import {
  describeNearlySpentSetting,
  describeThresholdBlank,
  formatThresholdValue,
  remainingContractPercent,
  THRESHOLD_SOURCE_LABEL,
  thresholdFieldHint,
  thresholdLine,
  thresholdLines,
  thresholdProblemSentences,
} from "./describe";
import {
  DEFAULT_THRESHOLDS,
  resolveThresholds,
  THRESHOLD_SOURCES,
} from "./resolve";
import { THRESHOLD_KEYS, THRESHOLD_SETTINGS } from "./settings";

describe("formatThresholdValue", () => {
  it("writes a share of the contract as a percentage", () => {
    expect(formatThresholdValue("nearlySpentPercent", 80)).toBe("80%");
  });

  it("writes a window as the days it is", () => {
    expect(formatThresholdValue("recentRateWindowDays", 14)).toBe("14 days");
  });

  it("does not write one day as one days", () => {
    expect(formatThresholdValue("recentRateWindowDays", 1)).toBe("1 day");
  });

  it("reads the unit off the spec, not off the key's spelling", () => {
    for (const key of THRESHOLD_KEYS) {
      const formatted = formatThresholdValue(key, 30);
      const expected = THRESHOLD_SETTINGS[key].unit === "days" ? "30 days" : "30%";
      expect(formatted).toBe(expected);
    }
  });
});

describe("remainingContractPercent", () => {
  it("is what the default watch threshold leaves behind", () => {
    expect(remainingContractPercent(80)).toBe(20);
  });

  it("follows a threshold somebody moved", () => {
    expect(remainingContractPercent(70)).toBe(30);
  });

  it("is nothing when a project is only flagged at the whole price", () => {
    expect(remainingContractPercent(100)).toBe(0);
  });
});

describe("THRESHOLD_SOURCE_LABEL", () => {
  it("names every source the resolution can report", () => {
    for (const source of THRESHOLD_SOURCES) {
      expect(THRESHOLD_SOURCE_LABEL[source]).toBeTruthy();
    }
  });

  it("gives the three a distinct answer each, since they are read side by side", () => {
    const labels = THRESHOLD_SOURCES.map(
      (source) => THRESHOLD_SOURCE_LABEL[source],
    );
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("thresholdLine", () => {
  it("reads the figure and its provenance off one resolution", () => {
    expect(
      thresholdLine("nearlySpentPercent", { value: 70, source: "client" }),
    ).toEqual({
      label: THRESHOLD_SETTINGS.nearlySpentPercent.label,
      value: "70%",
      source: THRESHOLD_SOURCE_LABEL.client,
      hint: THRESHOLD_SETTINGS.nearlySpentPercent.hint,
    });
  });

  it("writes a line for every setting in force on an unconfigured project", () => {
    for (const key of THRESHOLD_KEYS) {
      const line = thresholdLine(key, DEFAULT_THRESHOLDS[key]);
      expect(line.source).toBe(THRESHOLD_SOURCE_LABEL.default);
      expect(line.value).toBe(
        formatThresholdValue(key, THRESHOLD_SETTINGS[key].fallback),
      );
    }
  });
});

describe("describeNearlySpentSetting", () => {
  it("names the threshold and what it leaves behind", () => {
    expect(describeNearlySpentSetting(80)).toBe(
      "Flagged once 80% of the contract value is burned, which leaves 20% to cover whatever is still outstanding.",
    );
  });

  it("follows a threshold somebody moved, rather than naming a fifth", () => {
    expect(describeNearlySpentSetting(70)).toContain("leaves 30%");
  });

  /**
   * A legal setting and a real choice — "only tell me once the money has gone"
   * — so the sentence says what was chosen rather than printing "leaves 0%".
   */
  it("says plainly that the whole price leaves nothing", () => {
    expect(describeNearlySpentSetting(100)).toBe(
      "Flagged only once the whole contract value is burned, which leaves nothing to cover what is still outstanding.",
    );
  });

  /**
   * No form accepts a threshold past the whole price, so a row holding one was
   * hand-edited — and the sentence is rendered all the same, beneath the caveat
   * that says the setting is unusable. What it must not do is quote the
   * arithmetic, which hands back a remainder of minus a fifth.
   */
  it("refuses to name a negative remainder", () => {
    expect(describeNearlySpentSetting(120)).toBe(
      "Flagged once 120% of the contract value is burned, which is past the whole price — so this flag never fires, and an overspend is reported by the figures above it instead.",
    );
  });

  it("never prints a minus sign, whatever is stored", () => {
    for (const stored of [101, 120, 400]) {
      expect(describeNearlySpentSetting(stored)).not.toContain("-");
    }
  });
});

describe("thresholdProblemSentences", () => {
  it("says nothing about a project whose settings make sense", () => {
    expect(thresholdProblemSentences(DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it("names both figures of a crossed pair and where each came from", () => {
    const [sentence] = thresholdProblemSentences(
      resolveThresholds(
        { aheadOfDeliveryPercent: 50 },
        { farAheadOfDeliveryPercent: 20 },
      ),
    );

    expect(sentence).toContain("(50%, set on this project)");
    expect(sentence).toContain("(20%, from the client)");
    expect(sentence).toContain("nothing is ever merely watched");
  });

  it("names the one unusable setting in the singular", () => {
    const [sentence] = thresholdProblemSentences(
      resolveThresholds({ nearlySpentPercent: 400 }, {}),
    );

    expect(sentence).toContain("Contract nearly spent is set to a figure");
  });

  it("names several unusable settings together", () => {
    const [sentence] = thresholdProblemSentences(
      resolveThresholds({ nearlySpentPercent: 400, paceShiftPercent: 0 }, {}),
    );

    expect(sentence).toContain(
      "Contract nearly spent and Pace change are set to a figure",
    );
  });

  it("says the verdict was reached at the bad figure rather than hiding it", () => {
    const [sentence] = thresholdProblemSentences(
      resolveThresholds({ nearlySpentPercent: 400 }, {}),
    );

    expect(sentence).toContain("still what the verdict above was reached at");
  });

  it("reports both problems at once, worst first", () => {
    const sentences = thresholdProblemSentences(
      resolveThresholds(
        {
          nearlySpentPercent: 400,
          aheadOfDeliveryPercent: 50,
          farAheadOfDeliveryPercent: 20,
        },
        {},
      ),
    );

    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toContain("Contract nearly spent");
    expect(sentences[1]).toContain("merely watched");
  });
});

describe("describeThresholdBlank", () => {
  it("quotes the default a client's empty box falls to", () => {
    expect(describeThresholdBlank("nearlySpentPercent", "default")).toBe(
      "Leave blank to use Keel's default of 80%.",
    );
  });

  /**
   * A project's blank box is one rung lower, and the sentence has to say so: a
   * reader clearing a figure here is handing the decision to the client they
   * agreed it with, not to this repo.
   */
  it("names the client first for a project's empty box", () => {
    expect(describeThresholdBlank("nearlySpentPercent", "client")).toBe(
      "Leave blank to use the client's setting, or Keel's default of 80%.",
    );
  });

  it("quotes the figure in the setting's own unit", () => {
    expect(describeThresholdBlank("recentRateWindowDays", "default")).toBe(
      "Leave blank to use Keel's default of 14 days.",
    );
  });

  it("quotes a figure for every setting in the spec", () => {
    for (const key of THRESHOLD_KEYS) {
      const { fallback, unit } = THRESHOLD_SETTINGS[key];
      const figure = unit === "days" ? `${fallback} days` : `${fallback}%`;
      expect(describeThresholdBlank(key, "default")).toContain(figure);
    }
  });
});

describe("thresholdFieldHint", () => {
  it("says what the setting does, then what an empty box does", () => {
    expect(thresholdFieldHint("nearlySpentPercent", "client")).toBe(
      "The share of the contract value at which a project is flagged as worth watching. Leave blank to use the client's setting, or Keel's default of 80%.",
    );
  });

  it("carries both halves for every setting", () => {
    for (const key of THRESHOLD_KEYS) {
      const hint = thresholdFieldHint(key, "default");
      expect(hint).toContain(THRESHOLD_SETTINGS[key].hint);
      expect(hint).toContain("Leave blank");
    }
  });
});

describe("thresholdLines", () => {
  it("has a row for every setting, in the spec's order", () => {
    const lines = thresholdLines(DEFAULT_THRESHOLDS);

    expect(lines.map((line) => line.label)).toEqual(
      THRESHOLD_KEYS.map((key) => THRESHOLD_SETTINGS[key].label),
    );
  });

  it("agrees with the single-setting line for every key", () => {
    const resolved = resolveThresholds({ nearlySpentPercent: 70 }, null);

    expect(thresholdLines(resolved)).toEqual(
      THRESHOLD_KEYS.map((key) => thresholdLine(key, resolved[key])),
    );
  });

  /**
   * The provenance is what a reader acts on, so a row must carry the source of
   * its own figure and not of the one above it.
   */
  it("keeps each figure with the row it came from", () => {
    const lines = thresholdLines(
      resolveThresholds(
        { nearlySpentPercent: 70 },
        { recentRateWindowDays: 7 },
      ),
    );

    expect(lines[0]).toMatchObject({
      value: "70%",
      source: "Set on this project",
    });
    expect(lines[3]).toMatchObject({
      value: "7 days",
      source: "From the client",
    });
    expect(lines[4]).toMatchObject({ source: "Keel's default" });
  });
});
