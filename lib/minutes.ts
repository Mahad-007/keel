/**
 * Time is whole minutes everywhere in the codebase, the way money is whole
 * cents: a duration never passes through a float on its way to the database,
 * and nothing stores hours.
 *
 * People do not estimate in minutes, though — a deliverable is "a day and a
 * half", not "720". So the boundary where a duration meets a person goes
 * through here: hours in, minutes stored, minutes back out as something worth
 * reading.
 */

export const MINUTES_PER_HOUR = 60;

/**
 * `90` becomes `1h 30m`, `45` becomes `45m`, `120` becomes `2h`.
 *
 * Hours and minutes rather than decimal hours, because `1.75h` is a number to
 * convert and `1h 45m` is a duration to recognise. The unit is always written,
 * so a column of these cannot be misread as a count of something else.
 *
 * A fractional value is rounded rather than refused. The column is an integer
 * and these only ever come out of it, so a fraction means a hand-edited row —
 * and a page that will not render is a worse way to learn that than a number
 * that is a few seconds out.
 */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const sign = total < 0 ? "-" : "";
  const magnitude = Math.abs(total);

  const hours = Math.trunc(magnitude / MINUTES_PER_HOUR);
  const rest = magnitude % MINUTES_PER_HOUR;

  if (hours === 0) return `${sign}${rest}m`;
  if (rest === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${rest}m`;
}

/**
 * The other direction: `1.5` hours typed into a form becomes `90` minutes.
 * Throws on anything that is not a number of hours, the way `parseCents`
 * throws on anything that is not an amount — turning that into a sentence
 * somebody can act on is the form layer's job.
 *
 * Decimal hours rather than `1:30`, because the field is labelled hours and a
 * colon in it is ambiguous: `1:30` is an hour and a half to one reader and
 * half past one to another. A leading point is allowed — `.5` is how half an
 * hour gets typed by someone in a hurry.
 *
 * The result is rounded to the minute, which is the unit. An estimate given to
 * six decimal places is a spreadsheet's output, not a judgement, and storing
 * the seconds would imply a precision nobody intended.
 */
export function parseHours(input: string): number {
  const cleaned = input.trim().replace(/[\s,]/g, "");
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) {
    throw new Error(`not a number of hours: ${input}`);
  }
  return Math.round(Number(cleaned) * MINUTES_PER_HOUR);
}
