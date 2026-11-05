import Link from "next/link";

import { CaveatNote } from "@/components/form";
import { formatDate } from "@/lib/dates";
import {
  timeLogHref,
  withRange,
  type TimeLogQuery,
} from "@/lib/time/log-query";
import { reverseRange, type DateRange } from "@/lib/time/range";

/**
 * The note above a log whose date range runs backwards, and the link that
 * turns it round.
 *
 * A first day after the last holds no days, so the query comes back empty —
 * and an empty list under two date boxes that both have dates in them reads as
 * "there is no work here", which is the one wrong conclusion. Saying it in
 * words is the only way a reader can tell the difference, and the link saves
 * them retyping both boxes.
 *
 * Both ends are spelled out rather than described as a span. The span heading
 * drops a month it would otherwise repeat — `Oct 31 – 1, 2026` — which is
 * exactly the shape that makes a backwards range hard to see in the first
 * place.
 *
 * Amber rather than red, which is what `CaveatNote` means: nothing was refused
 * and nothing failed to save. The figures below are arithmetic over an empty
 * set, and they are not to be taken at face value.
 */
export function BackwardsRange({
  query,
  range,
}: {
  query: TimeLogQuery;
  /** The range as it was typed, both ends of which the sentence names. */
  range: DateRange & { from: string; to: string };
}) {
  return (
    <CaveatNote className="mt-4">
      The date range runs backwards: it starts on {formatDate(range.from)} and
      ends on {formatDate(range.to)}, so no day falls inside it and the log is
      empty whatever else is filtered.{" "}
      <Link
        href={timeLogHref(withRange(query, reverseRange(range)))}
        className="font-medium underline underline-offset-4"
      >
        Turn the range round
      </Link>
      .
    </CaveatNote>
  );
}
