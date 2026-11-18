import type { BurnSummary } from "@/lib/burn";
import { assessProjectCreep } from "@/lib/projects/creep-readings";
import {
  hasScopeHealthToShow,
  scopeHealthBanner,
} from "@/lib/projects/scope-health";
import type { ScopeLine } from "@/lib/scope";

/**
 * Why this project is flagged, in a sentence, at the top of its overview.
 *
 * The one thing on the page that reaches a conclusion. Everything else on the
 * project — the burn figures, the scope summary, the rollup — is a measurement,
 * and a reader has to hold two percentages in their head and decide what the
 * pair of them means. This decides, and then says what it decided on.
 *
 * Not a coloured dot, and not a bar. A dot says the project is amber and leaves
 * the reader to guess which of the two axes went wrong, by how much, and
 * whether anything was measurable at all — so the figure that matters never
 * reaches them and the one thing they can do about it is hover and hope. A
 * sentence costs four lines of the page and says all three.
 *
 * Nothing is computed here. The verdict is `lib/scope-creep.ts`, the readings
 * are `lib/projects/creep-readings.ts`, the words are
 * `lib/projects/scope-health.ts`, and this maps the four fields of a
 * `ScopeHealthBanner` onto four pieces of markup. The one decision left to the
 * component is the border colour, and it is taken from the verdict rather than
 * from any of the figures.
 */
export function ScopeHealthBanner({
  summary,
  lines,
}: {
  /** The burn, which carries the money axis whole. */
  summary: BurnSummary;
  /** The scope list, which carries the delivery axis and its caveats. */
  lines: readonly ScopeLine[];
}) {
  // A fact about the project rather than about this tab, so it is named and
  // tested in `lib/projects/scope-health.ts` and merely consulted here.
  if (!hasScopeHealthToShow(summary, lines.length)) return null;

  const banner = scopeHealthBanner(assessProjectCreep(summary, lines));

  return (
    <section className="mt-4 max-w-prose rounded border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {banner.headline}
      </h3>
      {/*
        The milestone, in one element. It is the first thing under the heading
        because a reader who stopped at the heading has been told a verdict and
        nothing else, and the next line is the only place they find out what it
        was reached from.
      */}
      <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {banner.verdict}
      </p>
    </section>
  );
}
