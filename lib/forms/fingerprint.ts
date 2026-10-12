/**
 * A short stamp standing for a piece of text, so a form with a preview step
 * can tell whether what it is being asked to commit is what was previewed.
 *
 * The need is particular to a two-press form. The reader pastes, presses
 * Preview, reads the table — and then may edit the box before pressing Import.
 * The second submission carries the edited text, so without this the thing
 * committed would be something nobody looked at, which is the one outcome a
 * preview step exists to prevent. The first press answers with a stamp, the
 * form posts it back beside the text, and a mismatch means the box moved.
 *
 * It is not a security measure and nothing here pretends otherwise: the text
 * arrives in the same submission as the stamp, so anything that can forge one
 * can forge both. It detects an edit, which is an accident, not an attack —
 * and the server re-reads the text from scratch on the commit press anyway, so
 * the worst a forged stamp buys is the import of a paste the forger composed
 * themselves.
 *
 * Both halves of the stamp have to collide for a change to go unnoticed, and
 * the length is one of them, so an edit that keeps the length has to also land
 * on the same 32-bit hash.
 */

/**
 * FNV-1a over the string's code units. Not a cryptographic hash and not used
 * as one — it is small, has no dependencies, and spreads single-character
 * edits across the whole output, which is the only property this needs.
 */
function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    // The FNV prime, multiplied in 32-bit arithmetic: `Math.imul` is what
    // keeps it from overflowing into a float and losing the low bits.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The stamp for a piece of text: its length and its hash, both in base 36. */
export function textFingerprint(text: string): string {
  return `${text.length.toString(36)}-${hash32(text).toString(36)}`;
}

/**
 * Whether the text still matches the stamp that came back with it.
 *
 * A blank stamp never matches, which is what makes the preview step
 * compulsory: a form submitted straight to the commit press carries no stamp,
 * so it is treated as text nobody has previewed rather than as text that
 * happens to agree.
 */
export function matchesFingerprint(stamp: string, text: string): boolean {
  const trimmed = stamp.trim();
  if (trimmed === "") return false;
  return trimmed === textFingerprint(text);
}
