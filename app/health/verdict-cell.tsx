import { isFlaggedBand } from "@/lib/health/band";
import type { PortfolioReading } from "@/lib/health/words";

/**
 * The verdict on one project, and why.
 *
 * Three things in one cell, read at three distances: the verdict, the clause
 * that says which comparison reached it, and — on the rare row that has one —
 * what the verdict could not see.
 *
 * No colour. The banner on a project page is coloured because it is one box
 * competing with a page of figures; a column of eleven coloured cells is a
 * column nobody reads a word of, and the word is the whole point. What a
 * reader needs here is the comparison named and the figures beside it, which
 * is what the three columns to the left of this one are for.
 *
 * The only emphasis is weight, and it is taken from the band rather than from
 * any figure — the same discipline the banner keeps about its border. A cell
 * that picked its own threshold would be a second classifier, and it would be
 * the one a reader believed.
 */
export function VerdictCell({ reading }: { reading: PortfolioReading }) {
  return (
    <>
      {/*
        The verdict in the page's own text colour either way, with weight
        marking the rows that are findings. A flagged row has to be findable
        from across the table; an on-track one has to not compete with it.
      */}
      <span
        className={
          isFlaggedBand(reading.band)
            ? "font-medium text-zinc-900 dark:text-zinc-100"
            : "text-zinc-700 dark:text-zinc-300"
        }
      >
        {reading.verdict}
      </span>
      {/*
        The clause under the verdict rather than beside it, so the verdict
        column stays one word wide down the page and the eye can run down it.
        Always present — a verdict with nothing under it is the coloured dot
        this page was built to replace.
      */}
      <span className="mt-0.5 block text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        {reading.reason}
      </span>
      {/*
        What the verdict could not see, under the reason and quieter still.
        Usually absent, which is why it drops out rather than leaving a gap: a
        caveat on every row is one nobody reads, and the row it mattered on
        would look like the rest.
      */}
      {reading.caveat === null ? null : (
        <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-500">
          {reading.caveat}
        </span>
      )}
    </>
  );
}
