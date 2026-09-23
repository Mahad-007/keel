/**
 * What counts as something to say.
 *
 * A form has three places that ask the question — the summary counting bad
 * fields, the focus hook looking for the first one, and the field itself
 * deciding whether to go red — and they must all answer it the same way. An
 * error of `""` that the summary counts but the field never shows leaves the
 * user reading "one field needs fixing" with five clean fields in front of
 * them, and no way to find the sixth.
 */

/** The message, trimmed, or null when there is nothing worth rendering. */
export function readableMessage(text: string | undefined): string | null {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}
