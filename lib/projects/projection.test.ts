import { describe, expect, it } from "vitest";

import { summariseBurn, type BurnSummary } from "@/lib/burn";
import type { BurnReading } from "@/lib/burndown/reading";
import { burnDownReading } from "@/lib/burndown/reading";
import type { EffectiveRate } from "@/lib/rates";
import type { ScopeLine } from "@/lib/scope";

import { projectionEvidence, projectProjection } from "./projection";
import {
  overallBurnRate,
  recentBurnRate,
  forecastPace,
  type BurnRate,
} from "@/lib/projection/rate";

/** $120.00 an hour, set on the project. */
const RATE: EffectiveRate = { cents: 12_000, source: "project" };

/** A reading built the way the chart builds it, from a stored row. */
function reading(
  onDate: string,
  burnedCents: number,
  origin: "recorded" | "backfilled" = "recorded",
): BurnReading {
  return burnDownReading({
    onDate,
    contractValueCents: 1_000_000,
    rateCents: RATE.cents,
    rateSource: RATE.source,
    entryCount: 1,
    loggedMinutes: (burnedCents * 60) / RATE.cents,
    billableMinutes: (burnedCents * 60) / RATE.cents,
    burnedCents,
    chargeableCents: burnedCents,
    origin,
  });
}

/** A scope line, as the two functions that read one see it. */
function line(
  estimatedMinutes: number,
  status: ScopeLine["status"] = "pending",
): ScopeLine {
  return { estimatedMinutes, status };
}

/** A burn summary for the hours a reading list ends on. */
function burn(
  burnedCents: number,
  contractedCents = 1_000_000,
  rate: EffectiveRate = RATE,
): BurnSummary {
  const minutes = Math.round((burnedCents * 60) / (rate.cents || 1));
  return summariseBurn(
    { entryCount: 4, loggedMinutes: minutes, billableMinutes: minutes },
    contractedCents,
    rate,
  );
}

/** Two months of measured readings ending on $4,000.00 burned. */
const HISTORY: BurnReading[] = [
  reading("2026-01-15", 50_000),
  reading("2026-02-01", 150_000),
  reading("2026-02-20", 280_000),
  reading("2026-03-10", 380_000),
  reading("2026-03-14", 400_000),
];

/** Ten hours delivered, twenty still to do. */
const LINES: ScopeLine[] = [line(600, "done"), line(600), line(600, "started")];

describe("projectionEvidence", () => {
  function evidenceFor(
    readings: readonly BurnReading[],
    lines: readonly ScopeLine[] = LINES,
    remainingCents = 240_000,
    today = "2026-03-14",
  ) {
    const overall = overallBurnRate(readings) as BurnRate;
    const recent = recentBurnRate(readings);
    return projectionEvidence(
      forecastPace(overall, recent),
      overall,
      recent,
      readings,
      lines,
      remainingCents,
      today,
    );
  }

  it("reads the span and the rows off the pace the forecast used", () => {
    // The forecast used the recent fortnight, so the evidence behind the date
    // is a fortnight — not the two months the project has been running.
    const evidence = evidenceFor(HISTORY);
    expect(evidence.paceDays).toBe(14);
    expect(evidence.readingCount).toBe(2);
  });

  it("counts only the reconstructions inside that span", () => {
    const readings = [
      reading("2026-01-15", 50_000, "backfilled"),
      reading("2026-02-20", 280_000, "backfilled"),
      reading("2026-03-10", 380_000, "backfilled"),
      reading("2026-03-14", 400_000),
    ];
    // The January and February rows are outside the fortnight the pace was
    // measured over, so they are not what the date rests on.
    expect(evidenceFor(readings).reconstructedCount).toBe(1);
  });

  it("measures the staleness from the last reading to today", () => {
    expect(
      evidenceFor(HISTORY, LINES, 240_000, "2026-03-20").daysSinceLastReading,
    ).toBe(6);
  });

  it("classifies the pace shift from the two paces", () => {
    // $1,200.00 over the last fortnight against $4,000.00 over fifty-nine
    // days: faster.
    expect(evidenceFor(HISTORY).paceShift).toBe("faster");
  });

  it("reports a window that is the whole history", () => {
    const young = [
      reading("2026-03-10", 50_000),
      reading("2026-03-14", 90_000),
    ];
    expect(evidenceFor(young).wholeHistoryWindow).toBe(true);
    expect(evidenceFor(HISTORY).wholeHistoryWindow).toBe(false);
  });

  it("counts the scope list and its unsized open lines", () => {
    const evidence = evidenceFor(HISTORY, [
      line(600, "done"),
      line(0),
      line(0, "started"),
      line(120),
    ]);
    expect(evidence.lineCount).toBe(4);
    expect(evidence.unsizedUndeliveredCount).toBe(2);
  });
});

describe("projectProjection", () => {
  it("projects the remaining scope at the pace the readings measured", () => {
    const projection = projectProjection(
      burn(400_000),
      LINES,
      HISTORY,
      "2026-03-14",
    );
    // Twenty hours still to do at $120.00 an hour: $2,400.00, on top of the
    // $4,000.00 already burned.
    expect(projection?.forecast.projectedFinalCents).toBe(640_000);
    expect(projection?.forecast.projectedOverageCents).toBe(0);
  });

  it("carries both paces so the choice of date can be checked", () => {
    const projection = projectProjection(
      burn(400_000),
      LINES,
      HISTORY,
      "2026-03-14",
    );
    expect(projection?.pace).toEqual(projection?.recentPace);
    expect(projection?.overallPace?.elapsedDays).toBe(59);
    expect(projection?.evidence.paceShift).toBe("faster");
  });

  it("grades a forecast built on a fortnight of measured rows", () => {
    const projection = projectProjection(
      burn(400_000),
      LINES,
      HISTORY,
      "2026-03-14",
    );
    // Two readings in the window, and the pace has moved.
    expect(projection?.caveats).toContain("few-readings");
    expect(projection?.confidence).toBe("weak");
  });

  it("reaches an overage when the remaining estimates pass the price", () => {
    const projection = projectProjection(
      burn(800_000),
      [line(600, "done"), line(3000)],
      HISTORY,
      "2026-03-14",
    );
    // $8,000.00 burned and fifty hours left at $120.00: $14,000.00 against a
    // $10,000.00 contract.
    expect(projection?.forecast.projectedFinalCents).toBe(1_400_000);
    expect(projection?.forecast.projectedOverageCents).toBe(400_000);
  });

  it("has no projection for a project with no readings", () => {
    expect(projectProjection(burn(0), LINES, [], "2026-03-14")).toBeNull();
  });

  it("has no projection when the readings have burned nothing", () => {
    expect(
      projectProjection(
        burn(0),
        LINES,
        [reading("2026-03-01", 0), reading("2026-03-14", 0)],
        "2026-03-14",
      ),
    ).toBeNull();
  });

  it("has no projection when nothing set a price", () => {
    // Every cent of the projected cost would count as overage, which would
    // read as a catastrophe on a project nobody has priced.
    expect(
      projectProjection(burn(400_000, 0), LINES, HISTORY, "2026-03-14"),
    ).toBeNull();
  });

  it("has no projection when every deliverable is done", () => {
    // Nothing left to project: the forecast would say the project finishes
    // today at what it has already cost.
    expect(
      projectProjection(
        burn(400_000),
        [line(600, "done"), line(600, "done")],
        HISTORY,
        "2026-03-14",
      ),
    ).toBeNull();
  });

  it("still projects a project with no deliverables at all", () => {
    // The end of the money is knowable without a scope list; the end of the
    // work is not, and the caveat says so.
    const projection = projectProjection(
      burn(400_000),
      [],
      HISTORY,
      "2026-03-14",
    );
    expect(projection?.caveats).toContain("no-scope");
    expect(projection?.forecast.contractRunsOutOn).not.toBeNull();
  });
});
