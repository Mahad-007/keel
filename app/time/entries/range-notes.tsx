import Link from "next/link";

import { CaveatNote } from "@/components/form";
import { formatDate } from "@/lib/dates";
import {
  timeLogHref,
  withProject,
  withRange,
  type TimeLogQuery,
} from "@/lib/time/log-query";
import { reverseRange } from "@/lib/time/range";

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
  range: { readonly from: string; readonly to: string };
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

/**
 * The note above a log whose project and client filters cannot both be
 * satisfied, and the link that drops the narrower one.
 *
 * A project belongs to one client, so a project filter naming somebody else's
 * project is a pair that matches nothing however the dates are set. Both
 * filters are real and both are showing in their pickers, which is what makes
 * this the hardest of the empty logs to read: every control looks right.
 *
 * The way out drops the project rather than the client, which is the rule
 * `withClient` follows — somebody who picked a client is asking to see that
 * client, and the project they had set belongs to a different question.
 *
 * Said as "does not belong to" rather than as a possessive, because the
 * client's name can carry an "(archived)" marker and `Pell & Sons
 * (archived)'s projects` is not a phrase anybody reads twice.
 */
export function MismatchedFilters({
  query,
  resolved,
}: {
  query: TimeLogQuery;
  /** Both names, so the sentence can say which two filters disagree. */
  resolved: { readonly project: string | null; readonly client: string | null };
}) {
  return (
    <CaveatNote className="mt-4">
      {resolved.project} does not belong to {resolved.client}, so no entry can
      match both filters and the log is empty whatever the dates say.{" "}
      <Link
        href={timeLogHref(withProject(query, null))}
        className="font-medium underline underline-offset-4"
      >
        Show every project for this client
      </Link>
      .
    </CaveatNote>
  );
}
