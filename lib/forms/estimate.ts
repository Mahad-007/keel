import { MINUTES_PER_HOUR, parseHours } from "@/lib/minutes";

import { invalid, valid, type FieldResult } from "./result";

/**
 * A deliverable's estimate as typed into a form: hours on the page, whole
 * minutes in the column.
 *
 * Blank is zero rather than null, because the schema has no third answer —
 * and zero already means "nobody has estimated this yet" everywhere it is
 * read. That reading is the point of the field: a scope list where an
 * unestimated deliverable looked like a free one would understate every
 * project it appeared in.
 */

/**
 * 1,000 hours — six months of full-time work on one line of a scope list.
 * Past this the likeliest reading is minutes typed as hours or a slipped
 * zero, and an estimate sixty times too large poisons every burn figure
 * derived from it.
 */
export const MAX_ESTIMATE_MINUTES = 1_000 * MINUTES_PER_HOUR;

export function optionalEstimateMinutes(
  value: string,
  label = "Estimate",
): FieldResult<number> {
  const trimmed = value.trim();
  if (trimmed === "") return valid(0);

  let minutes: number;
  try {
    minutes = parseHours(trimmed);
  } catch {
    return invalid(`${label} must be a number of hours, like 2 or 1.5.`);
  }

  if (minutes < 0) return invalid(`${label} cannot be negative.`);
  if (minutes > MAX_ESTIMATE_MINUTES) {
    return invalid(
      `${label} must be ${MAX_ESTIMATE_MINUTES / MINUTES_PER_HOUR} hours or less.`,
    );
  }
  return valid(minutes);
}
