import { CaveatNote } from "@/components/form";

import type { BurnSummary } from "@/lib/burn";
import type { BurnReading } from "@/lib/burndown/reading";
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_LEAD,
  describeProjectedOutcome,
  projectionCaveatSentences,
  projectionFigures,
} from "@/lib/projects/projected-completion";
import { projectProjection } from "@/lib/projects/projection";
import type { ScopeLine } from "@/lib/scope";

import { SummaryFigure } from "./summary-figure";

/** Ties the panel's region to the heading that names it. */
const HEADING_ID = "projected-completion-heading";

/**
 * Where this project is heading, and how much of that to believe.
 *
 * The first thing on the overview tab that is about a day which has not
 * happened. Everything above it reports: what was agreed, what the hours have
 * come to, how the line got here. All of those are facts somebody reacts to,
 * and by the time an overrun is a fact the only decisions left are about who
 * absorbs it. This panel is the one place the same figures point forwards,
 * which is the only moment the overrun can still be avoided.
 *
 * Under the burn-down, because the chart is the working. The pace every date
 * here is counted at was measured off the readings the chart draws, so a reader
 * who finds a date surprising has the shape it came from an inch above — and
 * the caveat that says which stretch was reconstructed is about the same rows
 * in both panels.
 *
 * The order inside is the one rule that matters here: the conclusion, then how
 * much to believe it, then the caveats, then the figures. Nothing that changes
 * how a number reads is allowed to arrive underneath it. A panel that put the
 * qualifications at the bottom would be a date with a footnote, and the whole
 * argument of this milestone is that a date without its caveats should not be
 * printed at all.
 *
 * Nothing is computed in the component and nothing is interactive. The
 * arithmetic is `lib/projection/`, the assembly is `projectProjection`, the
 * words are `lib/projects/projected-completion.ts`, and the figures go through
 * the same row the other three panels on this project use — so a reader moving
 * between them meets one kind of figure rather than four.
 */
export function ProjectionPanel({
  summary,
  lines,
  readings,
  today,
}: {
  /** The burn, which carries the price, the hours and the rate. */
  summary: BurnSummary;
  /** The scope list, which says how much work is left and how well sized it is. */
  lines: readonly ScopeLine[];
  /** Every stored reading, oldest first, which is where the pace comes from. */
  readings: readonly BurnReading[];
  /** The day the page is being rendered on, which every date counts from. */
  today: string;
}) {
  /*
    Null is the panel's whole visibility rule, and it is `projectProjection`'s
    judgement rather than this component's: no readings, no usable pace, no
    price to be over, or nothing left to deliver. Each of those is argued out
    beside the arithmetic, and a second opinion formed here would be the one a
    reader saw.
  */
  const projection = projectProjection(summary, lines, readings, today);
  if (projection === null) return null;

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800"
    >
      {/*
        The grade sits on the heading's own line rather than above the figures,
        because it is a property of the whole panel and a reader scanning the
        tab should be able to take it in without stopping. Baseline-aligned, so
        the small text sits on the heading's baseline instead of floating.
      */}
      <div className="flex items-baseline justify-between gap-4">
        <h3
          id={HEADING_ID}
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Projected completion
        </h3>
        {/*
          No colour and no dot. The scope health banner has this tab's one
          coloured box and it earned it by reaching a verdict about the
          project; this is a verdict about the evidence, and two amber boxes on
          one screen would make neither of them mean anything.
        */}
        <p className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
          {CONFIDENCE_LABEL[projection.confidence]}
        </p>
      </div>
      {/*
        The milestone, in one element: a reader who stops here has the figure
        the day was built to produce, with "at this pace" in front of it.
      */}
      <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-900 dark:text-zinc-100">
        {describeProjectedOutcome(projection)}
      </p>
      {/*
        How much to believe it, before the caveats it introduces and well
        before the figures. Secondary text, because it is the same sentence on
        every project of its grade and a reader learns it once.
      */}
      <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        {CONFIDENCE_LEAD[projection.confidence]}
      </p>
      {/*
        One note per caveat rather than a paragraph running them together, for
        the reason the burn panel's problems stack: they are separate things
        wrong, each with its own numbers and its own form to go and fix, and
        two problems in one sentence read as one.
      */}
      {projectionCaveatSentences(projection).map((caveat) => (
        <CaveatNote key={caveat} className="mt-2">
          {caveat}
        </CaveatNote>
      ))}
      <dl className="mt-4 text-sm">
        {projectionFigures(projection).map((figure) => (
          <SummaryFigure key={figure.label} {...figure} />
        ))}
      </dl>
    </section>
  );
}
